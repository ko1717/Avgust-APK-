# Construye el APK de depuración.
# La implementación está en tools/android-build.mjs (Windows, Linux y macOS).

$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'android-build.mjs')
if ($LASTEXITCODE -ne 0) { throw "Gradle terminó con código $LASTEXITCODE." }
