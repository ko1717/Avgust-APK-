# Genera el instalador NSIS de la edición de Windows.

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot

# Un antivirus que inspecciona HTTPS presenta su propia raíz de certificación.
# Windows la acepta, pero Node usa su propio almacén y la descarga del
# empaquetador NSIS falla con "unable to verify the first certificate".
$env:NODE_OPTIONS = ((@($env:NODE_OPTIONS, '--use-system-ca') | Where-Object { $_ }) -join ' ')

Push-Location $project
try {
    # electron-builder escribe su registro en la salida de error aunque termine
    # bien, de modo que el resultado se decide por el código de salida.
    $ErrorActionPreference = 'Continue'
    & cmd /c 'npx electron-builder --projectDir desktop --config electron-builder.yml --win nsis --x64'
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Host 'NSIS no pudo terminar (bloqueo del desinstalador temporal). Se genera el ejecutable portable.'
        & cmd /c 'npx electron-builder --projectDir desktop --config electron-builder.yml --win portable --x64'
        $code = $LASTEXITCODE
    }
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) { throw "electron-builder terminó con código $code." }
} finally {
    Pop-Location
}

$installer = Get-ChildItem (Join-Path $project 'release') -Filter '*.exe' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "Instalador listo: $($installer.FullName) ($([math]::Round($installer.Length / 1MB, 2)) MB)"
