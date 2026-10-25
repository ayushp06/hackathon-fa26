param(
    [string]$Port = 'COM8',
    [int]$BaudRate = 115200,
    [ValidateRange(0, 86400)]
    [int]$DurationSeconds = 0,
    [switch]$Raw
)

$ErrorActionPreference = 'Stop'
$serialMonitor = New-Object System.IO.Ports.SerialPort $Port,$BaudRate,([System.IO.Ports.Parity]::None),8,([System.IO.Ports.StopBits]::One)
$serialMonitor.ReadTimeout = 1500
$serialMonitor.Handshake = [System.IO.Ports.Handshake]::None
$serialMonitor.DtrEnable = $false
$serialMonitor.RtsEnable = $false
$monitorClock = [System.Diagnostics.Stopwatch]::StartNew()
$lastTime = 0.0
$lastRx = $null
$lastChanges = $null

try {
    $serialMonitor.Open()
    $serialMonitor.DiscardInBuffer()
    Write-Host "STM32 microphone monitor | $Port | $BaudRate baud | Ctrl+C to stop"
    Write-Host 'Speak or tap near the microphone. Level is digital peak dBFS, not calibrated sound pressure.'
    Write-Host 'One update every 100 ms; error counters should stay at zero.'
    while ($DurationSeconds -eq 0 -or $monitorClock.Elapsed.TotalSeconds -lt $DurationSeconds) {
        try {
            $line = $serialMonitor.ReadLine().Trim()
        } catch [System.TimeoutException] {
            Write-Host 'Waiting for serial data. Check the board and close other COM-port monitors.' -ForegroundColor Yellow
            continue
        }
        if ($Raw) {
            Write-Host $line
            continue
        }
        if ($line -notmatch '^rx=') {
            if ($line) { Write-Host $line -ForegroundColor Cyan }
            continue
        }
        $values = @{}
        foreach ($field in [regex]::Matches($line, '(?<key>[a-z]+)=(?<value>-?\d+)')) {
            $values[$field.Groups['key'].Value] = [long]$field.Groups['value'].Value
        }
        if (-not $values.ContainsKey('peak') -or -not $values.ContainsKey('rx')) { continue }
        $now = $monitorClock.Elapsed.TotalSeconds
        $sampleRate = 0.0
        $changeRate = 0.0
        if ($null -ne $lastRx -and $values.rx -ge $lastRx -and $now -gt $lastTime) {
            $sampleRate = ($values.rx - $lastRx) * 64.0 / ($now - $lastTime)
            $changeRate = [Math]::Max(0, $values.change - $lastChanges) / ($now - $lastTime)
        }
        $lastRx = $values.rx
        $lastChanges = $values.change
        $lastTime = $now
        $peak = [double]$values.peak
        $db = -120.0
        if ($peak -gt 0) { $db = 20.0 * [Math]::Log10($peak / 8388608.0) }
        $filled = [int][Math]::Round([Math]::Max(0, [Math]::Min(40, ($db + 80.0) / 2.0)))
        $bar = ('#' * $filled).PadRight(40, '.')
        $errors = $values.sync + $values.late + $values.dma + $values.ovr + $values.udr + $values.fre + $values.stall
        $color = 'Green'
        if ($peak -eq 0) { $color = 'Yellow' }
        if ($errors -gt 0 -or $values.fault -gt 0 -or $values.clip -gt 0) { $color = 'Red' }
        $display = '{0} [{1}] {2,6:N1} dBFS peak={3,8} sample={4,9} samples/s={5,5:N0} changes/s={6,5:N0} clip={7} errors={8} fault={9}' -f `
            (Get-Date -Format 'HH:mm:ss.fff'),$bar,$db,$values.peak,$values.sample,$sampleRate,$changeRate,$values.clip,$errors,$values.fault
        Write-Host $display -ForegroundColor $color
    }
} finally {
    if ($serialMonitor.IsOpen) { $serialMonitor.Close() }
    $serialMonitor.Dispose()
}
