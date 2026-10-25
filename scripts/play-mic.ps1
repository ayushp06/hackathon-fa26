param(
    [ValidatePattern('^COM\d+$')]
    [string]$Port = 'COM8',
    [int]$DeviceIndex = -1,
    [ValidateRange(0, 8)]
    [double]$Gain = 1,
    [ValidateRange(0, 86400)]
    [int]$DurationSeconds = 0,
    [string]$RecordPath,
    [switch]$ListDevices,
    [switch]$Background,
    [switch]$Stop,
    [switch]$Bypass,
    [switch]$EnableFilter,
    [switch]$ResetFilter
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$bridgeSource = Join-Path $PSScriptRoot 'MicSpeakerBridge.cs'
$bridgeBuild = Join-Path $projectRoot 'build'
$bridgeExe = Join-Path $bridgeBuild 'pc-mic-player.exe'
$bridgePidFile = Join-Path $bridgeBuild 'pc-mic-player.pid'
New-Item -ItemType Directory -Path $bridgeBuild -Force | Out-Null
$runningBridge = $null
if (Test-Path -LiteralPath $bridgePidFile) {
    $runningBridge = Get-Process -Id ([int](Get-Content -LiteralPath $bridgePidFile)) -ErrorAction SilentlyContinue
}
if ($Stop) {
    if ($runningBridge) {
        if ($runningBridge.Path -ne $bridgeExe) { throw 'Saved PID belongs to another process; it was not stopped.' }
        Stop-Process -Id $runningBridge.Id
        Write-Host 'Microphone speaker playback stopped.'
    } else { Write-Host 'No background microphone playback is running.' }
    if (Test-Path -LiteralPath $bridgePidFile) { Remove-Item -LiteralPath $bridgePidFile }
    return
}
if ($Bypass -or $EnableFilter -or $ResetFilter) {
    if (([int]$Bypass.IsPresent + [int]$EnableFilter.IsPresent + [int]$ResetFilter.IsPresent) -ne 1) {
        throw 'Choose only one filter command at a time.'
    }
    if (-not $runningBridge -or $runningBridge.Path -ne $bridgeExe) {
        throw 'Start background playback first, then send a filter command.'
    }
    $filterCommand = if ($Bypass) { 'b' } elseif ($EnableFilter) { 'n' } else { 'r' }
    $filterCommand | Set-Content -LiteralPath (Join-Path $bridgeBuild 'pc-audio-command.txt') -Encoding Ascii
    Write-Host "Queued filter command: $filterCommand"
    return
}
if ($ListDevices -and $runningBridge -and $runningBridge.Path -eq $bridgeExe) {
    & $bridgeExe --list
    exit $LASTEXITCODE
}
if ($runningBridge -and $runningBridge.Path -eq $bridgeExe) {
    throw 'Microphone playback is already running. Use .\scripts\play-mic.ps1 -Stop first.'
}
if (-not (Test-Path -LiteralPath $bridgeExe) -or
    (Get-Item -LiteralPath $bridgeSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $bridgeExe).LastWriteTimeUtc) {
    if (Test-Path -LiteralPath $bridgeExe) { Remove-Item -LiteralPath $bridgeExe }
    Add-Type -Path $bridgeSource -OutputAssembly $bridgeExe -OutputType ConsoleApplication -ReferencedAssemblies System.dll
}
if ($ListDevices) { & $bridgeExe --list; exit $LASTEXITCODE }
$bridgeArguments = @('--port', $Port, '--device', "$DeviceIndex", '--gain',
    $Gain.ToString([System.Globalization.CultureInfo]::InvariantCulture), '--duration', "$DurationSeconds")
if ($RecordPath) { $bridgeArguments += @('--record', $RecordPath) }
if ($Background) {
    if ($RecordPath) { throw 'Use foreground playback when recording a WAV file.' }
    $bridgeProcess = Start-Process -FilePath $bridgeExe -ArgumentList $bridgeArguments -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $bridgeBuild 'pc-mic-playback.log') `
        -RedirectStandardError (Join-Path $bridgeBuild 'pc-mic-playback-error.log')
    $bridgeProcess.Id | Set-Content -LiteralPath $bridgePidFile
    Write-Host "Microphone playback started, PID $($bridgeProcess.Id). Use .\scripts\play-mic.ps1 -Stop to stop it."
    return
}
& $bridgeExe @bridgeArguments
exit $LASTEXITCODE
