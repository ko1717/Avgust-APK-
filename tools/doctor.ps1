$ErrorActionPreference = "Stop"

Write-Host "AVGUST CARE 360 - Windows Developer Doctor" -ForegroundColor Cyan
Write-Host ""

function Test-Command($Name, $Label, $Required=$true) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    try { $v = & $Name --version 2>$null | Select-Object -First 1 } catch { $v = $cmd.Source }
    Write-Host ("[OK]   {0}: {1}" -f $Label, $v) -ForegroundColor Green
    return $true
  }
  $tag = if ($Required) { "FALTA" } else { "opcional" }
  Write-Host ("[WARN] {0}: {1}" -f $Label, $tag) -ForegroundColor Yellow
  return (-not $Required)
}

$ok = $true
$ok = (Test-Command "node" "Node.js") -and $ok
$ok = (Test-Command "npm" "npm") -and $ok
$ok = (Test-Command "git" "Git") -and $ok
$ok = (Test-Command "python" "Python") -and $ok
Test-Command "java" "Java" $false | Out-Null
Test-Command "adb" "Android Debug Bridge" $false | Out-Null

Write-Host ""
if (Test-Path "tools/base/capacitor-seed.apk") {
  Write-Host "[INFO] Existe la semilla compilada legacy: tools/base/capacitor-seed.apk" -ForegroundColor Yellow
} else {
  Write-Host "[INFO] No hay semilla APK local." -ForegroundColor DarkGray
}

if (Test-Path "src") {
  Write-Host "[OK]   Se encontró src/: existe un árbol de aplicación fuente." -ForegroundColor Green
} else {
  Write-Host "[BLOCK] No existe src/: el repositorio todavía no contiene el árbol fuente principal de la aplicación." -ForegroundColor Red
  $ok = $false
}

Write-Host ""
if ($ok) {
  Write-Host "Doctor: entorno listo para desarrollo fuente." -ForegroundColor Green
  exit 0
} else {
  Write-Host "Doctor: no se debe iniciar una migración de UI sobre un APK compilado como fuente de verdad." -ForegroundColor Red
  exit 2
}
