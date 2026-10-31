param(
    [ValidateRange(1, 60)]
    [int]$TimeoutSeconds = 25,
    [string]$PackagePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workspaceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$outputDirectory = Join-Path $workspaceDirectory 'output/godot-migration'
$packageDirectory = Join-Path $outputDirectory 'windows'
if (-not [string]::IsNullOrWhiteSpace($PackagePath)) {
    $packageDirectory = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($PackagePath)) { $PackagePath } else { Join-Path $workspaceDirectory $PackagePath }))
}
if (-not $packageDirectory.StartsWith($workspaceDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Package verification must remain inside the workspace.'
}
$executable = Join-Path $packageDirectory 'WastelandEcho.exe'
$manifest = [IO.File]::ReadAllText((Join-Path $packageDirectory 'build-manifest.json')) | ConvertFrom-Json
$actualHash = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
if ($manifest.sourceDirty -or $manifest.sha256 -ne $actualHash) {
    throw 'Package must match its manifest and have been built from a clean source commit.'
}
$engineLog = Join-Path $outputDirectory 'package-engine.log'
$stdoutLog = Join-Path $outputDirectory 'package-stdout.log'
$stderrLog = Join-Path $outputDirectory 'package-stderr.log'
$probeProcess = Start-Process -FilePath $executable -WorkingDirectory $packageDirectory `
    -ArgumentList @('--headless', '--audio-driver', 'Dummy', '--max-fps', '60',
        '--quit-after', '180', '--log-file', ('"' + $engineLog + '"'), '--', '--qa-package') `
    -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
if (-not $probeProcess.WaitForExit($TimeoutSeconds * 1000)) {
    $probeProcess.Kill()
    throw 'Standalone package self-check timed out.'
}
$probeProcess.Refresh()
$log = [IO.File]::ReadAllText($engineLog)
$line = $log -split '\r?\n' | Where-Object { $_.StartsWith('GODOT_PACKAGE_SMOKE ') } | Select-Object -Last 1
if ($probeProcess.ExitCode -ne 0 -or $log -match '(SCRIPT ERROR|ERROR):' -or -not $line) {
    throw "Standalone package self-check failed; inspect $engineLog"
}
$report = $line.Substring('GODOT_PACKAGE_SMOKE '.Length) | ConvertFrom-Json
if ($report.failures.Count -ne 0 -or $report.maps -ne 3 -or $report.mapsWithArt -ne 3 `
        -or $report.sharedMapAtlases -ne 4 -or $report.paintedMaps -ne 1 -or $report.images -ne 59 `
        -or $report.audio -ne 30 -or $report.weapons -ne 20 -or $report.fieldcraftArt -ne 69) {
    throw 'Standalone package content or map resources failed validation.'
}
$result = [ordered]@{
    packagePath = $packageDirectory.Substring($workspaceDirectory.Length + 1).Replace('\', '/')
    sourceCommit = $manifest.sourceCommit
    sourceDirty = $manifest.sourceDirty
    sha256 = $actualHash
    passed = $true
    report = $report
    scope = 'Exported package resources and headless combat only; not rendered, device or long-session acceptance.'
}
[IO.File]::WriteAllText((Join-Path $outputDirectory 'package-smoke.json'),
    ($result | ConvertTo-Json -Depth 6) + "`n", [Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 6
