param([string]$BuildDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) 'build'))
$ErrorActionPreference = 'Stop'
$statusFile = Join-Path $BuildDirectory 'hardware-status.json'
$commandFile = Join-Path $BuildDirectory 'hardware-command.txt'
function Read-LiveStatus {
    $state = $null
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        try { $state = [IO.File]::ReadAllText($statusFile) | ConvertFrom-Json; break }
        catch [IO.IOException] { Start-Sleep -Milliseconds 10 }
    }
    if ($null -eq $state) { throw 'Unable to read audio telemetry after 20 attempts.' }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if (-not $state.streaming -or $state.protocol -ne 4 -or $now - $state.timestampMs -gt 1500) {
        throw "A live MIC4 audio bridge is required: $($state.error)"
    }
    return $state
}
$initial = Read-LiveStatus
if (-not $initial.referenceClock) { throw 'Both microphone receivers are required for the spatial check.' }
$commandSequence = [int]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() % 1000000000)
$results = @()
function Apply-Control([int]$Id, [int]$Value, [string]$Name) {
    $script:commandSequence++
    $temporary = "$commandFile.dsp-check.tmp"
    [IO.File]::WriteAllText($temporary, "$Id $Value $script:commandSequence")
    if (Test-Path -LiteralPath $commandFile) { [IO.File]::Replace($temporary, $commandFile, $null) }
    else { [IO.File]::Move($temporary, $commandFile) }
    $deadline = [DateTime]::UtcNow.AddSeconds(3)
    do {
        Start-Sleep -Milliseconds 30
        $state = Read-LiveStatus
        if ($state.commandSequence -eq $script:commandSequence) {
            if ($state.commandStatus -ne 0 -or $state.values.$Name -ne $Value) { throw "Rejected/mismatched $Name" }
            Write-Host "Verified $Name=$Value (sequence $script:commandSequence)"
            return $state
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "No firmware acknowledgment for $Name"
}
$names = @('volume','noiseReduction','speechAmplification','bass','mid','treble','eq250','eq500','eq2000','eq4000')
try {
    $results += Apply-Control 0 25 'volume'
    for ($id=1; $id -lt 10; $id++) {
        $results += Apply-Control $id $(if ($id -lt 3) { 40 } else { 3 }) $names[$id]
    }
    $results += Apply-Control 12 100 'reduceLoudSounds'
    $focused = Apply-Control 13 100 'spatialFocus'
    if (-not $focused.spatialActive) { throw 'Spatial focus acknowledged but reference signal is absent.' }
    $results += $focused
    $muted = Apply-Control 0 0 'volume'
    # Allow the documented 20 ms gain ramp and telemetry update to finish.
    Start-Sleep -Milliseconds 250
    $muted = Read-LiveStatus
    if ($muted.outputRms -ne 0) { throw "Mute did not silence output: RMS=$($muted.outputRms)" }
    $results += $muted
} finally {
    # Restore the actual initial settings, including after an assertion fails.
    for ($id=1; $id -lt 10; $id++) { $null = Apply-Control $id $initial.values.($names[$id]) $names[$id] }
    $null = Apply-Control 12 $initial.values.reduceLoudSounds 'reduceLoudSounds'
    $null = Apply-Control 13 $initial.values.spatialFocus 'spatialFocus'
    $null = Apply-Control 0 $initial.values.volume 'volume'
}
$results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $BuildDirectory 'dsp-hardware-check.json')
Write-Host 'PASS: all twelve DSP settings acknowledged; spatial processing active; mute RMS zero; initial settings restored.'
