$ErrorActionPreference='Stop'
$base='http://localhost:3000'
function Assert($condition,$description){if(-not $condition){throw $description};Write-Output "PASS $description"}
$anon=Invoke-WebRequest "$base/api/visits" -SkipHttpErrorCheck
Assert ($anon.StatusCode -eq 401) 'Anonymous requests rejected'
$null=Invoke-WebRequest "$base/signin-with-chatgpt?return_to=%2F" -SessionVariable session
$auditContacts=@(@{name='Contacto de auditoría';role='Prueba';phone='3000000000';email='auditoria@test.invalid';receiveReports=$false})
$auditFarmName="PRUEBA AUDITORIA $([guid]::NewGuid())"
$auditFarmResponse=Invoke-WebRequest "$base/api/team" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='create';name=$auditFarmName;zone='Prueba';contacts=$auditContacts}|ConvertTo-Json -Depth 10) -SkipHttpErrorCheck
Assert ($auditFarmResponse.StatusCode -eq 200) 'Farm audit test data created'
$auditFarm=$auditFarmResponse.Content|ConvertFrom-Json
$auditResponse=Invoke-WebRequest "$base/api/audit?farmId=$($auditFarm.id)" -WebSession $session -SkipHttpErrorCheck
Assert ($auditResponse.StatusCode -eq 200) 'Manager reads farm audit trail'
$auditEvents=$auditResponse.Content|ConvertFrom-Json
Assert (($auditEvents.events|Where-Object event -eq 'farm.created').Count -eq 1) 'Farm creation is audited'
Assert (-not $auditResponse.Content.Contains('auditoria@test.invalid')) 'Audit response excludes contact data'
$anonymousAudit=Invoke-WebRequest "$base/api/audit?farmId=$($auditFarm.id)" -SkipHttpErrorCheck
Assert ($anonymousAudit.StatusCode -eq 401) 'Anonymous audit access rejected'
$v=@{id='';revision=0;farm=$auditFarmName;farmId=$auditFarm.id;date='2026-09-08';city='';zone='';technician='Técnico de prueba';responsible='Prueba';rtc='';chapters=@(3);answers=@{};notes=@{};recommendations=@{};measurements=@{};delivery='';followup='';conclusion='';photos=@();reviewed=$false}
function PostVisit($data){Invoke-WebRequest "$base/api/visits" -WebSession $session -Method Post -ContentType 'application/json' -Body ($data|ConvertTo-Json -Depth 20) -SkipHttpErrorCheck}
$created=PostVisit $v
Assert ($created.StatusCode -eq 200) 'Draft saved'
$saved=$created.Content|ConvertFrom-Json
$stale=$created.Content|ConvertFrom-Json
Assert ($saved.revision -eq 1) 'Initial revision recorded'
$saved.conclusion='Conclusión actualizada'
$updated=PostVisit $saved
Assert ($updated.StatusCode -eq 200) 'Existing draft updated'
Assert ((PostVisit $stale).StatusCode -eq 409) 'Concurrent stale write rejected'
$saved=$updated.Content|ConvertFrom-Json
$saved.reviewed=$true
Assert ((PostVisit $saved).StatusCode -eq 422) 'Incomplete review rejected'
$saved.answers=@{'3.1'=@{value='SI';observation='';recommendation=''};'3.2'=@{value='SI';observation='';recommendation=''};'3.3'=@{value='NO';observation='Vehículo sin cierre';recommendation='Asegurar el cierre'};'3.4'=@{value='NA';observation='';recommendation=''}}
$reviewed=PostVisit $saved
Assert ($reviewed.StatusCode -eq 200) 'Complete reviewed report saved'
$list=Invoke-RestMethod "$base/api/visits" -WebSession $session
Assert (($list|Where-Object id -eq $saved.id).reviewed -eq $true) 'Saved report read back'
$reportDraftResponse=Invoke-WebRequest "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='create';visitId=$saved.id}|ConvertTo-Json) -SkipHttpErrorCheck
Assert ($reportDraftResponse.StatusCode -eq 200) 'Formal report draft created'
$reportDraft=$reportDraftResponse.Content|ConvertFrom-Json
$submittedResponse=Invoke-WebRequest "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='submit';id=$reportDraft.id;revision=$reportDraft.revision}|ConvertTo-Json) -SkipHttpErrorCheck
Assert ($submittedResponse.StatusCode -eq 200) 'Formal report snapshot submitted for review'
$submitted=$submittedResponse.Content|ConvertFrom-Json
$snapshot=Invoke-RestMethod "$base/api/reports/$($reportDraft.id)" -WebSession $session
Assert ($snapshot.snapshot.content.farm -eq $auditFarmName) 'Submitted snapshot preserves farm text'
Assert ($snapshot.snapshot.content.answers.'3.3'.recommendation -eq 'Asegurar el cierre') 'Submitted snapshot preserves technical content'
$changed=$reviewed.Content|ConvertFrom-Json
$changed.conclusion='Cambio después del envío'
$changedResponse=PostVisit $changed
Assert ($changedResponse.StatusCode -eq 200) 'Visit can continue after report submission'
$changed=$changedResponse.Content|ConvertFrom-Json
$staleApproval=Invoke-WebRequest "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='approve';id=$submitted.id;revision=$submitted.revision}|ConvertTo-Json) -SkipHttpErrorCheck
Assert ($staleApproval.StatusCode -eq 409) 'Approval detects a changed source visit'
$returned=Invoke-RestMethod "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='return';id=$submitted.id;revision=$submitted.revision}|ConvertTo-Json)
$resent=Invoke-RestMethod "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='submit';id=$returned.id;revision=$returned.revision}|ConvertTo-Json)
$approved=Invoke-RestMethod "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='approve';id=$resent.id;revision=$resent.revision}|ConvertTo-Json)
$published=Invoke-RestMethod "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='publish';id=$approved.id;revision=$approved.revision}|ConvertTo-Json)
Assert ($published.status -eq 'published') 'Formal report published from its frozen snapshot'
$versionTwo=Invoke-RestMethod "$base/api/reports" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{op='new_version';visitId=$saved.id}|ConvertTo-Json)
Assert ($versionTwo.versionNumber -eq 2) 'New version is created without changing the published version'
$dossier=Invoke-RestMethod "$base/api/farms/$($auditFarm.id)/dossier?limit=2" -WebSession $session
Assert ($dossier.summary.visits -eq 1) 'Farm dossier counts visits from the original record'
Assert ($dossier.summary.reports -eq 1) 'Farm dossier counts reviewed reports'
Assert ($dossier.events.Count -eq 2) 'Farm dossier returns a bounded activity page'
Assert (($dossier.events|Where-Object visitId -eq $saved.id).Count -ge 1) 'Farm dossier links activity to its original visit'
$directVisit=Invoke-WebRequest "$base/api/visits/$($saved.id)" -WebSession $session -SkipHttpErrorCheck
Assert ($directVisit.StatusCode -eq 200) 'Original visit opens directly from its identifier'
$metricPrior=$changed|ConvertTo-Json -Depth 20|ConvertFrom-Json
$metricPrior.measurements=@{ph='6.40';pressure='30';volume='0';equipment='Jacto XP'}
$metricPriorResponse=PostVisit $metricPrior
Assert ($metricPriorResponse.StatusCode -eq 200) 'Prior numeric metrics saved on the original visit'
$changed=$metricPriorResponse.Content|ConvertFrom-Json
$metricCurrent=$changed|ConvertTo-Json -Depth 20|ConvertFrom-Json
$metricCurrent.id='';$metricCurrent.revision=0;$metricCurrent.date='2026-10-10';$metricCurrent.photos=@();$metricCurrent.actions=@{}
$metricCurrent.answers=@{'3.1'=@{value='SI';observation='';recommendation=''};'3.2'=@{value='SI';observation='';recommendation=''};'3.3'=@{value='SI';observation='';recommendation=''};'3.4'=@{value='NA';observation='';recommendation=''}}
$metricCurrent.measurements=@{ph='6.10';pressure='32';volume='2';equipment='Jacto XP'}
$metricCurrentResponse=PostVisit $metricCurrent
Assert ($metricCurrentResponse.StatusCode -eq 200) 'Current numeric metrics saved as a separate visit'
$metricCurrentSaved=$metricCurrentResponse.Content|ConvertFrom-Json
$metricHistory=Invoke-RestMethod "$base/api/farms/$($auditFarm.id)/metrics?metric=ph&limit=1" -WebSession $session
Assert ($metricHistory.points.Count -eq 1 -and $metricHistory.points[0].originalValue -eq '6.10') 'Metric history returns the newest paginated point'
Assert ($metricHistory.nextCursor) 'Metric history returns a cursor'
$metricPriorPage=Invoke-RestMethod "$base/api/farms/$($auditFarm.id)/metrics?metric=ph&limit=1&cursor=$([uri]::EscapeDataString($metricHistory.nextCursor))" -WebSession $session
Assert ($metricPriorPage.points[0].originalValue -eq '6.40') 'Metric history returns the prior point through its cursor'
$metricComparison=Invoke-RestMethod "$base/api/farms/$($auditFarm.id)/metrics/compare" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{visitAId=$changed.id;visitBId=$metricCurrentSaved.id}|ConvertTo-Json)
Assert (($metricComparison.comparisons|Where-Object {$_.metric.id -eq 'ph'}).comparison.delta -eq -0.3) 'Metric comparison calculates the numeric difference'
Assert (($metricComparison.comparisons|Where-Object {$_.metric.id -eq 'compliance'}).comparison.differenceLabel -eq '+33 puntos porcentuales') 'Compliance uses percentage points'
Assert (($metricComparison.comparisons|Where-Object {$_.metric.id -eq 'volume'}).comparison.relativeChange -eq $null) 'Relative change is omitted when the prior value is zero'
Assert (($metricComparison.comparisons|Where-Object {$_.metric.id -eq 'equipment'}).comparison.change -eq 'same') 'Textual metric comparison reports unchanged text'
$cross=Invoke-WebRequest "$base/api/visits" -WebSession $session -Method Post -Headers @{Origin='https://untrusted.example'} -ContentType 'application/json' -Body ($saved|ConvertTo-Json -Depth 20) -SkipHttpErrorCheck
Assert ($cross.StatusCode -eq 403) 'Cross-origin write rejected'
$session.Headers.Remove('Origin')
$bad=Invoke-WebRequest "$base/api/photos" -WebSession $session -Method Post -ContentType 'image/png' -Body ([Text.Encoding]::UTF8.GetBytes('not an image')) -SkipHttpErrorCheck
Assert ($bad.StatusCode -eq 400) 'Invalid photo rejected'
$png=[Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=')
$photo=Invoke-RestMethod "$base/api/photos?farmId=$($auditFarm.id)" -WebSession $session -Method Post -ContentType 'image/png' -Body $png
$image=Invoke-WebRequest "$base/api/photos/$($photo.id)" -WebSession $session
Assert ($image.StatusCode -eq 200) 'Photo upload and authorized retrieval'
Assert ((Invoke-WebRequest "$base/api/photos/$($photo.id)" -SkipHttpErrorCheck).StatusCode -eq 401) 'Anonymous photo retrieval rejected'

$saved=$changed
$saved.reviewed=$false
$saved.photos=@(@{id=$photo.id;caption='Evidencia de cierre';chapter=3})
$saved.actions=@{'3.3'=@{owner='Ana';due='2026-09-10';status='closed';closure='Cierre verificado';photoId=$photo.id}}
$actionSaved=PostVisit $saved
Assert ($actionSaved.StatusCode -eq 200) 'Closed action with owned photo saved'
$list=Invoke-RestMethod "$base/api/visits" -WebSession $session
$readBack=$list|Where-Object id -eq $saved.id
Assert ($readBack.actions.'3.3'.status -eq 'closed') 'Action status survives reload'
Assert ($readBack.actions.'3.3'.photoId -eq $photo.id) 'Closure evidence survives reload'
$readBack.actions.'3.3'.photoId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
Assert ((PostVisit $readBack).StatusCode -eq 400) 'Unlinked closure photo rejected'
$closed=$actionSaved.Content|ConvertFrom-Json
$commitments=Invoke-RestMethod "$base/api/commitments?farmId=$($auditFarm.id)&bucket=completed&limit=1" -WebSession $session
Assert ($commitments.items.Count -eq 1) 'Completed commitment is listed from the original visit'
Assert ($commitments.items[0].action.completedBy) 'Completion actor is recorded server-side'
$reopenedResponse=Invoke-WebRequest "$base/api/commitments" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{visitId=$closed.id;criterionId='3.3';revision=$closed.revision;action=@{owner='Ana';due='2026-09-12';status='progress';closure='Validación adicional programada'}}|ConvertTo-Json -Depth 10) -SkipHttpErrorCheck
Assert ($reopenedResponse.StatusCode -eq 200) 'Commitment reopened with current visit revision'
$reopened=$reopenedResponse.Content|ConvertFrom-Json
Assert ($reopened.action.reopenedAt) 'Reopening timestamp is recorded'
$cancelledResponse=Invoke-WebRequest "$base/api/commitments" -WebSession $session -Method Post -ContentType 'application/json' -Body (@{visitId=$closed.id;criterionId='3.3';revision=$reopened.revision;action=@{owner='Ana';due='2026-09-12';status='cancelled';closure='Compromiso cancelado'}}|ConvertTo-Json -Depth 10) -SkipHttpErrorCheck
Assert ($cancelledResponse.StatusCode -eq 200) 'Commitment cancellation is accepted'
$cancelled=Invoke-RestMethod "$base/api/commitments?farmId=$($auditFarm.id)&status=cancelled" -WebSession $session
Assert (($cancelled.items|Where-Object criterionId -eq '3.3').Count -eq 1) 'Cancelled commitment is filtered server-side'
$finalAudit=Invoke-RestMethod "$base/api/audit?farmId=$($auditFarm.id)" -WebSession $session
Assert (($finalAudit.events|Where-Object event -eq 'commitment.reopened').Count -eq 1) 'Commitment reopening is audited'
Assert (($finalAudit.events|Where-Object event -eq 'commitment.cancelled').Count -eq 1) 'Commitment cancellation is audited'
"DELETE FROM report_versions WHERE farm_id = '$($auditFarm.id)'; DELETE FROM visits WHERE farm_id = '$($auditFarm.id)'; DELETE FROM photos WHERE id = '$($photo.id)'; DELETE FROM audit_events WHERE farm_id = '$($auditFarm.id)'; DELETE FROM farm_contacts WHERE farm_id = '$($auditFarm.id)'; DELETE FROM farm_members WHERE farm_id = '$($auditFarm.id)'; DELETE FROM farm_invitations WHERE farm_id = '$($auditFarm.id)'; DELETE FROM service_requests WHERE farm_id = '$($auditFarm.id)'; DELETE FROM farms WHERE id = '$($auditFarm.id)';" | Set-Content '.wrangler/cleanup-test.sql'
