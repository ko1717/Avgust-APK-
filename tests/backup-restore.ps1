$ErrorActionPreference = 'Stop'
# Preserve each SQL/argument as one native-command argument on Windows PowerShell 7.
$PSNativeCommandArgumentPassing = 'Standard'

# This test deliberately creates a brand-new local Wrangler state on every run.
# It never accepts --remote and does not read the application's normal .wrangler state.
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wranglerConfig = Join-Path $projectRoot 'dist\server\wrangler.json'
if (-not (Test-Path -LiteralPath $wranglerConfig)) {
  throw 'No existe dist/server/wrangler.json. Ejecuta npm run build antes de probar respaldo central.'
}
$wranglerSettings = Get-Content -LiteralPath $wranglerConfig -Raw | ConvertFrom-Json
$r2Bucket = $wranglerSettings.r2_buckets[0].bucket_name
if ([string]::IsNullOrWhiteSpace($r2Bucket)) {
  throw 'La configuración compilada no define un bucket R2 para la prueba de respaldo.'
}

$runId = "run-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$runRoot = Join-Path $projectRoot "work\backup-restore\$runId"
$d1SourceRoot = Join-Path $runRoot 'd1-source'
$d1RecoveryRoot = Join-Path $runRoot 'd1-recovery'
$d1SourceConfig = Join-Path $d1SourceRoot 'wrangler.json'
$d1RecoveryConfig = Join-Path $d1RecoveryRoot 'wrangler.json'
$r2State = Join-Path $runRoot 'r2-state'
$artifacts = Join-Path $runRoot 'artifacts'
$env:XDG_CONFIG_HOME = Join-Path $runRoot 'wrangler-config'
$env:WRANGLER_SEND_METRICS = 'false'
New-Item -ItemType Directory -Force -Path $d1SourceRoot, $d1RecoveryRoot, $r2State, $artifacts, $env:XDG_CONFIG_HOME | Out-Null
# `d1 export --local` persists relative to the configuration file and does not
# accept --persist-to. Copying the generated configuration gives source and
# recovery their own .wrangler directories instead of touching the app state.
Copy-Item -LiteralPath $wranglerConfig -Destination $d1SourceConfig
Copy-Item -LiteralPath $wranglerConfig -Destination $d1RecoveryConfig

function Invoke-Wrangler {
  param([string[]]$Arguments)
  & npx.cmd wrangler @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler terminó con código ${LASTEXITCODE}: $($Arguments -join ' ')"
  }
}

function Invoke-WranglerText {
  param([string[]]$Arguments)
  $output = & npx.cmd wrangler @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler terminó con código ${LASTEXITCODE}: $($Arguments -join ' ')`n$($output -join "`n")"
  }
  return ($output -join "`n")
}

function Assert-Contains {
  param([string]$Text, [string]$Expected, [string]$Message)
  if ($Text -notmatch [regex]::Escape($Expected)) { throw $Message }
}

function Assert-Match {
  param([string]$Text, [string]$Pattern, [string]$Message)
  if ($Text -notmatch $Pattern) { throw $Message }
}

Push-Location $projectRoot
try {
  $migrationFiles = Get-ChildItem -LiteralPath (Join-Path $projectRoot 'drizzle') -Filter '*.sql' | Sort-Object Name
  if ($migrationFiles.Count -eq 0) { throw 'No se encontraron migraciones D1.' }

  foreach ($migration in $migrationFiles) {
    Invoke-Wrangler @('d1', 'execute', 'DB', '--local', '--config', $d1SourceConfig, '--file', $migration.FullName)
  }

  $testFarmId = 'backup-restore-farm'
  $testVisitId = 'backup-restore-visit'
  $testReportId = 'backup-restore-report'
  $payload = '{"id":"backup-restore-visit","farm":"Finca de respaldo"}'
  $snapshot = '{"schema":1,"source":{"visitId":"backup-restore-visit","visitRevision":1},"farm":{"name":"Finca de respaldo","city":"","zone":"","participants":[]},"content":{"farm":"Finca de respaldo","date":"2026-09-10"},"sections":[],"indicator":{"score":null}}'
  $insert = "INSERT INTO farms (id, owner, name, zone, contact) VALUES ('$testFarmId', 'backup-test-owner', 'Finca de respaldo', '', ''); INSERT INTO visits (id, owner, farm_id, farm, date, payload, revision, updated) VALUES ('$testVisitId', 'backup-test-owner', '$testFarmId', 'Finca de respaldo', '2026-09-10', '$payload', 1, '2026-09-10T00:00:00.000Z'); INSERT INTO report_versions (id, farm_id, visit_id, version_number, status, source_visit_revision, created_by, created_at, snapshot_json, revision, updated_at) VALUES ('$testReportId', '$testFarmId', '$testVisitId', 1, 'published', 1, 'backup-test-owner', '2026-09-10T00:00:00.000Z', '$snapshot', 1, '2026-09-10T00:00:00.000Z');"
  Invoke-Wrangler @('d1', 'execute', 'DB', '--local', '--config', $d1SourceConfig, '--command', $insert)

  $sourceRecord = Invoke-WranglerText @('d1', 'execute', 'DB', '--local', '--config', $d1SourceConfig, '--command', "SELECT id, owner, farm, date, revision FROM visits WHERE id = '$testVisitId';", '--json')
  Assert-Contains $sourceRecord $testVisitId 'La visita de prueba no quedó registrada en D1 local.'

  $d1Backup = Join-Path $artifacts 'd1-backup.sql'
  Invoke-Wrangler @('d1', 'export', 'DB', '--local', '--config', $d1SourceConfig, '--output', $d1Backup)
  if (-not (Test-Path -LiteralPath $d1Backup)) { throw 'Wrangler no generó el respaldo SQL de D1.' }
  $d1Sql = Get-Content -LiteralPath $d1Backup -Raw
  Assert-Contains $d1Sql 'CREATE TABLE' 'El respaldo D1 no contiene esquema.'
  Assert-Contains $d1Sql $testVisitId 'El respaldo D1 no contiene la visita de prueba.'
  Assert-Contains $d1Sql $testReportId 'El respaldo D1 no contiene la versión de informe de prueba.'

  # Simulates a damaging change in the source. Recovery is loaded into an isolated target,
  # which is the safe equivalent of replacing the production binding only after validation.
  Invoke-Wrangler @('d1', 'execute', 'DB', '--local', '--config', $d1SourceConfig, '--command', "DELETE FROM report_versions WHERE id = '$testReportId'; DELETE FROM visits WHERE id = '$testVisitId';")
  $deleted = Invoke-WranglerText @('d1', 'execute', 'DB', '--local', '--config', $d1SourceConfig, '--command', "SELECT COUNT(*) AS visit_count FROM visits WHERE id = '$testVisitId';", '--json')
  Assert-Match $deleted '"visit_count"\s*:\s*0' 'La visita de prueba no fue eliminada de la fuente antes de restaurar.'

  Invoke-Wrangler @('d1', 'execute', 'DB', '--local', '--config', $d1RecoveryConfig, '--file', $d1Backup)
  $restored = Invoke-WranglerText @('d1', 'execute', 'DB', '--local', '--config', $d1RecoveryConfig, '--command', "SELECT id, owner, farm, date, revision FROM visits WHERE id = '$testVisitId';", '--json')
  foreach ($expected in @($testVisitId, 'backup-test-owner', 'Finca de respaldo', '2026-09-10')) {
    Assert-Contains $restored $expected 'La restauración D1 no conservó todos los datos de la visita de prueba.'
  }
  Assert-Match $restored '"revision"\s*:\s*1' 'La restauración D1 no conservó la revisión de la visita de prueba.'
  $restoredReport = Invoke-WranglerText @('d1', 'execute', 'DB', '--local', '--config', $d1RecoveryConfig, '--command', "SELECT id, visit_id, version_number, status, source_visit_revision FROM report_versions WHERE id = '$testReportId';", '--json')
  foreach ($expected in @($testReportId, $testVisitId, 'published')) {
    Assert-Contains $restoredReport $expected 'La restauración D1 no conservó la versión de informe de prueba.'
  }
  Assert-Match $restoredReport '"version_number"\s*:\s*1' 'La restauración D1 no conservó el número de versión del informe.'

  $sourceObject = Join-Path $artifacts 'photo-source.txt'
  $r2Backup = Join-Path $artifacts 'photo-r2-backup.txt'
  $r2Restored = Join-Path $artifacts 'photo-restored.txt'
  [System.IO.File]::WriteAllText($sourceObject, 'AVGUST CARE 360 - evidencia de respaldo R2', [System.Text.UTF8Encoding]::new($false))
  $objectPath = "$r2Bucket/backup-restore/$runId-photo.txt"
  Invoke-Wrangler @('r2', 'object', 'put', $objectPath, '--local', '--config', $wranglerConfig, '--persist-to', $r2State, '--file', $sourceObject, '--content-type', 'text/plain', '--force')
  Invoke-Wrangler @('r2', 'object', 'get', $objectPath, '--local', '--config', $wranglerConfig, '--persist-to', $r2State, '--file', $r2Backup)
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $sourceObject).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $r2Backup).Hash) {
    throw 'El objeto recuperado de R2 no coincide con la evidencia original.'
  }

  Invoke-Wrangler @('r2', 'object', 'delete', $objectPath, '--local', '--config', $wranglerConfig, '--persist-to', $r2State, '--force')
  & npx.cmd wrangler r2 object get $objectPath --local --config $wranglerConfig --persist-to $r2State --file $r2Restored 2>$null
  if ($LASTEXITCODE -eq 0) { throw 'El objeto R2 sigue disponible después de eliminarlo.' }

  Invoke-Wrangler @('r2', 'object', 'put', $objectPath, '--local', '--config', $wranglerConfig, '--persist-to', $r2State, '--file', $r2Backup, '--content-type', 'text/plain', '--force')
  Invoke-Wrangler @('r2', 'object', 'get', $objectPath, '--local', '--config', $wranglerConfig, '--persist-to', $r2State, '--file', $r2Restored)
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $sourceObject).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $r2Restored).Hash) {
    throw 'El objeto R2 restaurado no conserva su contenido original.'
  }

  Write-Output "PASS: D1 local export, deletion and isolated recovery; R2 local backup, deletion and hash-verified restore. Artifacts: $runRoot"
}
finally {
  Pop-Location
}
