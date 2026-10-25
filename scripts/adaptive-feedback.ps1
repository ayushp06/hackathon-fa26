param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('correct','enable','disable','clear')]
    [string]$Action,
    [ValidateRange(0,100)]
    [int]$Strength = 50
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$commandPath = Join-Path $workspace 'build/hardware-command.txt'
$statusPath = Join-Path $workspace 'build/hardware-status.json'
if (-not (Test-Path -LiteralPath $statusPath)) { throw 'Start the existing MIC4 player first.' }
$status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
$age = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - [double]$status.timestampMs
if (-not $status.streaming -or $status.error -or $status.protocol -ne 4 -or $age -lt -1000 -or $age -gt 1500) {
    throw 'Fresh fault-free MIC4 streaming is required.'
}
if (Test-Path -LiteralPath $commandPath) { throw 'Another command is pending; wait and retry.' }
$id = if ($Action -eq 'correct') {14} elseif ($Action -eq 'clear') {16} else {15}
$value = if ($Action -eq 'correct') {$Strength} elseif ($Action -eq 'enable') {1} else {0}
$sequence = [BitConverter]::ToUInt32([Guid]::NewGuid().ToByteArray(),0)
if ($sequence -eq 0) { $sequence = 1 }
# FileMode.CreateNew refuses an existing command instead of overwriting another owner.
$bytes = [Text.Encoding]::ASCII.GetBytes("$id $value $sequence")
$file = [IO.File]::Open($commandPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $file.Write($bytes,0,$bytes.Length) } finally { $file.Dispose() }
$clock = [Diagnostics.Stopwatch]::StartNew()
while ($clock.ElapsedMilliseconds -lt 4000) {
    Start-Sleep -Milliseconds 50
    $status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
    if ($status.commandSequence -eq $sequence) {
        if ($status.commandStatus -ne 0) { throw 'Firmware rejected the event: check fresh stable context, reference and adaptive build.' }
        Write-Host "Applied explicit adaptive command $Action (sequence $sequence)."
        return
    }
}
throw 'No matching firmware acknowledgment. Do not open another serial owner; inspect playback logs.'
