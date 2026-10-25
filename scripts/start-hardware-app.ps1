param(
    [string]$Port = 'COM8',
    [int]$DeviceIndex = 0,
    [ValidateRange(0, 8)]
    [double]$Gain = 1,
    [switch]$Stop,
    [switch]$NoWeb
)
$ErrorActionPreference = 'Stop'
$wavelengthRoot = Split-Path $PSScriptRoot -Parent
$wavelengthBuild = Join-Path $wavelengthRoot 'build'
New-Item -ItemType Directory -Path $wavelengthBuild -Force | Out-Null

function Stop-WavelengthHelper([string]$Name) {
    $helperRecordPath = Join-Path $wavelengthBuild ($Name + '.process.json')
    if (-not (Test-Path -LiteralPath $helperRecordPath)) { return }
    $helperRecord = Get-Content -LiteralPath $helperRecordPath -Raw | ConvertFrom-Json
    $helperProcess = Get-Process -Id $helperRecord.id -ErrorAction SilentlyContinue
    if ($helperProcess) {
        $helperExpectedExecutable = $helperRecord.executable
        if (-not $helperExpectedExecutable) { $helperExpectedExecutable = (Get-Command node -ErrorAction Stop).Source }
        if ($helperProcess.Path -ne $helperExpectedExecutable -or $helperProcess.StartTime.ToUniversalTime().Ticks.ToString() -ne $helperRecord.startTicks) {
            throw "Saved $Name PID belongs to a different process; it was not stopped."
        }
        Stop-Process -Id $helperProcess.Id
    }
    Remove-Item -LiteralPath $helperRecordPath
}
function Start-WavelengthHelper([string]$Name,[string[]]$Arguments) {
    Stop-WavelengthHelper $Name
    $nodeExecutable = (Get-Command node -ErrorAction Stop).Source
    $helperProcess = Start-Process -FilePath $nodeExecutable -ArgumentList $Arguments -WorkingDirectory $wavelengthRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $wavelengthBuild ($Name + '.log')) `
        -RedirectStandardError (Join-Path $wavelengthBuild ($Name + '-error.log'))
    @{ id=$helperProcess.Id; executable=$nodeExecutable; startTicks=$helperProcess.StartTime.ToUniversalTime().Ticks.ToString() } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $wavelengthBuild ($Name + '.process.json'))
}

if ($Stop) {
    Stop-WavelengthHelper 'hardware-api'
    Stop-WavelengthHelper 'hardware-web'
    & (Join-Path $PSScriptRoot 'play-mic.ps1') -Stop
    return
}
if (-not $NoWeb -and -not (Test-Path -LiteralPath (Join-Path $wavelengthRoot 'hearing-app/node_modules/expo/bin/cli'))) {
    throw 'Install the app dependencies first: cd hearing-app; npm ci'
}
& (Join-Path $PSScriptRoot 'play-mic.ps1') -Stop
$oldHardwareCommand = Join-Path $wavelengthBuild 'hardware-command.txt'
if (Test-Path -LiteralPath $oldHardwareCommand) { Remove-Item -LiteralPath $oldHardwareCommand }
& (Join-Path $PSScriptRoot 'play-mic.ps1') -Port $Port -DeviceIndex $DeviceIndex -Gain $Gain -Background
Start-WavelengthHelper 'hardware-api' @('scripts/hardware-server.mjs')
if (-not $NoWeb) {
    Start-WavelengthHelper 'hardware-web' @('hearing-app/node_modules/expo/bin/cli','start','hearing-app','--web','--host','localhost','--port','8081','--max-workers','2')
}
Write-Host 'Hardware API: http://127.0.0.1:8765/api/status'
if (-not $NoWeb) { Write-Host 'Open http://localhost:8081 and choose Connect USB. Use Relearn noise while staying quiet for two seconds.' }
Write-Host 'Stop with .\scripts\start-hardware-app.ps1 -Stop'
