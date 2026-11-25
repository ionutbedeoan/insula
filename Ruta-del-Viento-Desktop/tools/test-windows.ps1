param([switch]$PicturesOnly, [switch]$HighQuality)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$game = Join-Path $project 'Builds\Windows-Daylight\Ruta-del-Viento.exe'
if (-not (Test-Path -LiteralPath $game)) { throw 'Build the Windows player first.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $project ('Builds\Verification\' + $stamp)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$log = Join-Path $output 'player.log'
$arguments = @('-screen-fullscreen', '0', '-screen-width', '1280', '-screen-height', '720',
    '-logFile', ('"' + $log + '"'), '-ruta-smoke', ('"' + $output + '"'))
if ($PicturesOnly) { $arguments += '-ruta-pictures' }
if ($HighQuality) { $arguments += '-ruta-high' }
$process = Start-Process -FilePath $game -ArgumentList $arguments -PassThru
$activation = New-Object -ComObject WScript.Shell
for ($attempt = 0; $attempt -lt 30 -and !$process.HasExited; $attempt++) {
    $process.Refresh()
    if ($process.MainWindowHandle -ne [IntPtr]::Zero -and $activation.AppActivate($process.Id)) { break }
    Start-Sleep -Milliseconds 250
}
if (-not $process.WaitForExit(240000)) {
    Stop-Process -Id $process.Id
    Get-Content -LiteralPath $log -Tail 50
    throw "Windows player verification timed out. See $log."
}
$report = Join-Path $output 'smoke.txt'
if (-not (Test-Path -LiteralPath $report)) {
    Get-Content -LiteralPath $log -Tail 50
    throw "Windows player exited without verification. See $log."
}
Get-Content -LiteralPath $report
if ($process.ExitCode -eq 0) {
    Add-Type -AssemblyName System.Drawing
    $bitmap = [Drawing.Bitmap]::new((Join-Path $output '01-meniu.png'))
    try {
        $carPixels = 0
        $terrainPixels = 0
        $errorPixels = 0
        for ($y = [int]($bitmap.Height * .48); $y -lt $bitmap.Height * .79; $y += 4) {
            for ($x = [int]($bitmap.Width * .30); $x -lt $bitmap.Width * .72; $x += 4) {
                $pixel = $bitmap.GetPixel($x, $y)
                if ($pixel.R -gt 76 -and $pixel.R -gt 1.55 * $pixel.G -and $pixel.R -gt 1.45 * $pixel.B) { $carPixels++ }
                if ($pixel.R -gt 130 -and $pixel.B -gt 115 -and $pixel.G -lt 65) { $errorPixels++ }
            }
            for ($x = [int]($bitmap.Width * .83); $x -lt $bitmap.Width * .98; $x += 4) {
                $pixel = $bitmap.GetPixel($x, $y)
                if ($pixel.R -gt 74 -and $pixel.R -gt $pixel.G + 12 -and $pixel.G -gt $pixel.B + 12) { $terrainPixels++ }
            }
        }
        if ($carPixels -lt 150 -or $terrainPixels -lt 100 -or $errorPixels -gt 30) {
            throw "Rendering regression in $output (paint $carPixels, coastal terrain $terrainPixels, shader error color $errorPixels)."
        }
        $visual = "PASS Visible car paint and coastal terrain in the Windows frame ($carPixels, $terrainPixels samples)"
        Add-Content -LiteralPath $report -Value $visual
        Write-Output $visual
    } finally {
        $bitmap.Dispose()
    }
}
Write-Output $output
exit $process.ExitCode
