# Prepara la cadena de herramientas de Android dentro de .android-build.
# La carpeta está fuera del control de versiones y no modifica el sistema:
# el JDK, el SDK y la caché de Gradle quedan junto al proyecto y se retiran
# eliminando esa carpeta.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Join-Path (Split-Path -Parent $PSScriptRoot) '.android-build'
$jdk = Join-Path $root 'jdk'
$sdk = Join-Path $root 'sdk'
$platform = 'android-35'
$buildTools = 'build-tools;35.0.0'
$cmdlineTools = 'https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip'
$jdkSource = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse'

# Estas herramientas escriben avisos en la salida de error aunque terminen bien,
# y con ErrorActionPreference en Stop eso abortaría la preparación.
function Invoke-Tool {
    param([string]$File, [string[]]$Arguments = @(), [string]$StandardInput)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($StandardInput) { $output = $StandardInput | & $File @Arguments 2>&1 }
        else { $output = & $File @Arguments 2>&1 }
    } finally { $ErrorActionPreference = $previous }
    return (($output | ForEach-Object { "$_" }) -join "`n")
}

function Expand-Download($uri, $name, $target) {
    $zip = Join-Path $root "$name.zip"
    Write-Host "Descargando $name…"
    Invoke-WebRequest -Uri $uri -OutFile $zip -UseBasicParsing
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $target)
    Remove-Item $zip -Force
}

New-Item -ItemType Directory -Force -Path $root | Out-Null

if (-not (Test-Path (Join-Path $jdk 'bin\java.exe'))) {
    $staging = Join-Path $root 'jdk-staging'
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    Expand-Download $jdkSource 'jdk' $staging
    Move-Item (Get-ChildItem $staging -Directory)[0].FullName $jdk
    Remove-Item $staging -Recurse -Force
}
$env:JAVA_HOME = $jdk
Write-Host "JDK: $((Invoke-Tool "$jdk\bin\java.exe" @('-version')) -split "`n" | Select-Object -First 1)"

$sdkmanager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) {
    $staging = Join-Path $root 'sdk-staging'
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    Expand-Download $cmdlineTools 'cmdline-tools' $staging
    New-Item -ItemType Directory -Force -Path (Join-Path $sdk 'cmdline-tools') | Out-Null
    Move-Item (Join-Path $staging 'cmdline-tools') (Join-Path $sdk 'cmdline-tools\latest')
    Remove-Item $staging -Recurse -Force
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

# Un antivirus que inspecciona TLS presenta su propia raíz. Windows la acepta y
# Java no, de modo que la descarga del SDK y de Gradle falla con PKIX. Se añade
# esa raíz únicamente al almacén del JDK local.
if ((Invoke-Tool $sdkmanager @('--list')) -match 'SSLHandshakeException|PKIX path building failed') {
    Write-Host 'La conexión TLS está siendo inspeccionada; se confía su raíz en el JDK local.'
    $client = New-Object Net.Sockets.TcpClient('dl.google.com', 443)
    $accept = [Net.Security.RemoteCertificateValidationCallback] { param($a, $b, $c, $d) $true }
    $ssl = New-Object Net.Security.SslStream($client.GetStream(), $false, $accept)
    try {
        $ssl.AuthenticateAsClient('dl.google.com')
        $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
        $chain.ChainPolicy.RevocationMode = 'NoCheck'
        [void]$chain.Build((New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)))
        $ca = $chain.ChainElements[$chain.ChainElements.Count - 1].Certificate
    } finally {
        $ssl.Dispose()
        $client.Dispose()
    }
    $cer = Join-Path $root 'interception-root.cer'
    [IO.File]::WriteAllBytes($cer, $ca.Export('Cert'))
    $store = @('-keystore', "$jdk\lib\security\cacerts", '-storepass', 'changeit')
    Invoke-Tool "$jdk\bin\keytool.exe" (@('-delete', '-alias', 'tls-interception-root') + $store) | Out-Null
    Invoke-Tool "$jdk\bin\keytool.exe" (@('-importcert', '-noprompt', '-trustcacerts', '-alias', 'tls-interception-root', '-file', $cer) + $store) | Out-Null
    Write-Host "Raíz aceptada: $($ca.Subject)"
}

Invoke-Tool $sdkmanager @('--licenses') -StandardInput ("y`r`n" * 60) | Out-Null
Invoke-Tool $sdkmanager @('platform-tools', "platforms;$platform", $buildTools) | Out-Null
if (-not (Test-Path (Join-Path $sdk "platforms\$platform"))) {
    throw "No se instaló $platform. Ejecute $sdkmanager a mano para ver el motivo."
}

$properties = Join-Path (Split-Path -Parent $PSScriptRoot) 'android\local.properties'
"sdk.dir=$($sdk -replace '\\', '\\\\' -replace ':', '\:')" | Set-Content $properties -Encoding ASCII

Write-Host "Cadena de herramientas lista en $root. Construya con: npm run android:apk"
