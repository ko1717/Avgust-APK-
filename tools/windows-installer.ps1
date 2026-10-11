# Genera el instalador NSIS de la edición de Windows.
# La implementación está en tools/desktop-installer.mjs (Windows, Linux y macOS).

$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'desktop-installer.mjs')
if ($LASTEXITCODE -ne 0) { throw "electron-builder terminó con código $LASTEXITCODE." }
