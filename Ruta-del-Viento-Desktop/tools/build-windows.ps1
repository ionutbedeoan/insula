param([string]$UnityEditor, [string]$LocalPackages)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $UnityEditor) {
    $locations = @(
        (Join-Path $env:ProgramFiles 'Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe'),
        (Join-Path $env:ProgramFiles 'Unity\Editor\Unity.exe')
    )
    $UnityEditor = $locations | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $UnityEditor -or -not (Test-Path -LiteralPath $UnityEditor)) {
    throw 'Unity 6000.6.10f1 editor is required. Pass its executable as -UnityEditor.'
}

$logs = Join-Path $project 'Logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$log = Join-Path $logs 'Windows-build.log'
$buildProject = $project
if (-not $LocalPackages) {
    $cached = Join-Path $env:LOCALAPPDATA 'RutaDelVientoUpm\6000.6.10f1'
    if (Test-Path -LiteralPath (Join-Path $cached 'com.unity.render-pipelines.universal\package.json')) { $LocalPackages = $cached }
}
if ($LocalPackages) {
    # Use an isolated project when Windows rejects Package Manager cache renames.
    $buildProject = Join-Path $env:LOCALAPPDATA 'RutaDelVientoBuild\UnityProject'
    New-Item -ItemType Directory -Path (Join-Path $buildProject 'Packages') -Force | Out-Null
    $assets = Join-Path $project 'Assets'
    $junction = Join-Path $buildProject 'Assets'
    if (Test-Path -LiteralPath $junction) {
        $link = Get-Item -LiteralPath $junction
        if ($link.LinkType -ne 'Junction' -or @($link.Target)[0] -ne $assets) { throw "Existing build staging folder belongs to another project: $buildProject" }
    } else {
        New-Item -ItemType Junction -Path $junction -Target $assets | Out-Null
        Copy-Item -LiteralPath (Join-Path $project 'ProjectSettings') -Destination $buildProject -Recurse
    }
    Copy-Item -LiteralPath (Join-Path $project 'THIRD_PARTY_NOTICES.md') -Destination $buildProject -Force
    $manifest = Get-Content -LiteralPath (Join-Path $project 'Packages\manifest.json') -Raw | ConvertFrom-Json
    foreach ($package in Get-ChildItem -LiteralPath $LocalPackages -Directory) {
        $metadata = Get-Content -LiteralPath (Join-Path $package.FullName 'package.json') -Raw | ConvertFrom-Json
        if ($package.Name -ne $metadata.name) { throw "Unexpected package directory: $($package.FullName)" }
        $manifest.dependencies | Add-Member -MemberType NoteProperty -Name $metadata.name -Value ('file:' + $package.FullName.Replace('\', '/')) -Force
    }
    [IO.File]::WriteAllText((Join-Path $buildProject 'Packages\manifest.json'), ($manifest | ConvertTo-Json -Depth 5))
}
$output = Join-Path $project 'Builds\Windows-Daylight'
$arguments = @('-batchmode', '-nographics', '-quit', '-projectPath', ('"' + $buildProject + '"'),
    '-buildTarget', 'Win64', '-executeMethod', 'RutaDelViento.Editor.CoastProject.BuildWindows',
    '-ruta-output', ('"' + $output + '"'), '-logFile', ('"' + $log + '"'))
$process = Start-Process -FilePath $UnityEditor -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) {
    Get-Content -LiteralPath $log -Tail 70
    exit $process.ExitCode
}
$shaderErrors = Select-String -LiteralPath $log -Pattern '^Shader error in '
if ($shaderErrors) {
    $shaderErrors | ForEach-Object { Write-Output $_.Line }
    throw "Unity finished with shader compilation errors. See $log."
}
$executable = Join-Path $output 'Ruta-del-Viento.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw "Unity did not produce $executable. See $log." }
Write-Output $executable
