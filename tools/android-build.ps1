# Construye el APK de depuración. Usa la cadena de herramientas local de
# .android-build cuando existe y, si no, el JDK y el SDK del sistema.

$ErrorActionPreference = 'Stop'

$project = Split-Path -Parent $PSScriptRoot
$root = Join-Path $project '.android-build'
$jdk = Join-Path $root 'jdk'
$sdk = Join-Path $root 'sdk'

if (Test-Path (Join-Path $jdk 'bin\java.exe')) {
    $env:JAVA_HOME = $jdk
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk
    $env:GRADLE_USER_HOME = Join-Path $root 'gradle-home'
} elseif (-not $env:JAVA_HOME) {
    throw 'No hay JDK. Ejecute: npm run android:toolchain'
}

Push-Location (Join-Path $project 'android')
try {
    # Gradle escribe avisos en la salida de error aunque la compilación termine
    # bien, de modo que el resultado se decide por el código de salida.
    $ErrorActionPreference = 'Continue'
    & cmd /c '.\gradlew.bat assembleDebug'
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "Gradle terminó con código $code." }
} finally {
    Pop-Location
}

$apk = Join-Path $project 'android\app\build\outputs\apk\debug\app-debug.apk'
$size = [math]::Round((Get-Item $apk).Length / 1MB, 2)
Write-Host "APK listo: $apk ($size MB)"
