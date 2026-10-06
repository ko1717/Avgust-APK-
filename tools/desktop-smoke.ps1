# Arranca la edición de Windows sin mostrar la ventana y comprueba que la
# interfaz carga: funciones de la navegación, logotipo, datos locales, puente de
# respaldo y ausencia de inicio de sesión.

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$report = Join-Path ([IO.Path]::GetTempPath()) 'care360-smoke.json'
if (Test-Path $report) { Remove-Item $report -Force }

Push-Location $project
try {
    $ErrorActionPreference = 'Continue'
    & cmd /c "npx electron desktop --smoke-test=$report" | Out-Null
    $ErrorActionPreference = 'Stop'
} finally {
    Pop-Location
}

if (-not (Test-Path $report)) { throw 'La aplicación no llegó a informar el resultado.' }
$result = Get-Content $report -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $result.ok) { throw "Interfaz de Windows incompleta: $($result.error)" }
Write-Host "PASS: interfaz de Windows, funciones ($($result.result.tabs.Count)), logotipo, datos locales y puente de respaldo"
