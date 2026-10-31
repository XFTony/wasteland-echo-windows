param(
    [string]$GodotPath = $env:GODOT_PATH,
    [string]$DestinationDirectory = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workspaceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ([string]::IsNullOrWhiteSpace($GodotPath)) {
    $GodotPath = 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe'
}
$outputDirectory = Join-Path $workspaceDirectory 'output/godot-migration/windows'
if (-not [string]::IsNullOrWhiteSpace($DestinationDirectory)) {
    $outputDirectory = [IO.Path]::GetFullPath($(if ([IO.Path]::IsPathRooted($DestinationDirectory)) { $DestinationDirectory } else { Join-Path $workspaceDirectory $DestinationDirectory }))
}
if (-not $outputDirectory.StartsWith($workspaceDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Package output must remain inside the workspace.'
}
$executable = Join-Path $outputDirectory 'WastelandEcho.exe'
if (Test-Path -LiteralPath $executable) {
    try {
        $probeHandle = [IO.File]::Open($executable, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $probeHandle.Dispose()
    } catch {
        throw 'The existing preview is in use or cannot be replaced. Close its window or select another -DestinationDirectory.'
    }
}
$version = ([IO.File]::ReadAllText((Join-Path $workspaceDirectory 'package.json')) | ConvertFrom-Json).version
$preset = [IO.File]::ReadAllText((Join-Path $workspaceDirectory 'godot/export_presets.cfg'))
if ($preset -notmatch 'application/product_version="([^"]+)"' -or $Matches[1] -ne $version) {
    throw 'Synchronize the Godot export product version with package.json before building.'
}
$templateDirectory = Join-Path $workspaceDirectory 'output/godot-migration/toolchain/templates'
$templateHashes = @{
    'windows_debug_x86_64.exe' = '51498b72b3a237f882ebd7d1787f06a4bc1eaf0572daab93837adcfd3cfdc107'
    'windows_release_x86_64.exe' = 'd34d36f3be1a6c49c56525ae86469b92e4f417ddf0b43cf00dd80c385c4b0562'
}
foreach ($filename in $templateHashes.Keys) {
    $templatePath = Join-Path $templateDirectory $filename
    if (-not (Test-Path -LiteralPath $templatePath) -or (Get-FileHash -LiteralPath $templatePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $templateHashes[$filename]) {
        throw "Verified Windows template required: $filename. Run prepare-windows-templates.ps1 first."
    }
}
[IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
& $GodotPath --headless --path (Join-Path $workspaceDirectory 'godot') --log-file (Join-Path $workspaceDirectory 'output/godot-migration/version-engine.log') --script scripts/tools/check_version.gd -- $version
if ($LASTEXITCODE -ne 0) { throw 'Native catalog version does not match package.json.' }
$logPath = Join-Path $workspaceDirectory 'output/godot-migration/export.log'
$stagingDirectory = [IO.Path]::GetFullPath((Join-Path $outputDirectory ('staging-' + [Guid]::NewGuid().ToString('N'))))
if (-not $stagingDirectory.StartsWith($outputDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Windows staging directory must stay inside the package directory.'
}
[IO.Directory]::CreateDirectory($stagingDirectory) | Out-Null
$stagingExecutable = Join-Path $stagingDirectory 'WastelandEcho.exe'
# Export into a fresh directory: Windows can reject the embedded-PCK rename over an existing executable.
& $GodotPath --headless --path (Join-Path $workspaceDirectory 'godot') --log-file (Join-Path $workspaceDirectory 'output/godot-migration/export-engine.log') --export-release 'Windows Desktop' $stagingExecutable *> $logPath
$exportExit = $LASTEXITCODE
$log = [IO.File]::ReadAllText($logPath)
if ($exportExit -ne 0 -or $log -match '(SCRIPT ERROR|ERROR):') { throw "Godot export failed; inspect $logPath" }
$executable = Join-Path $outputDirectory 'WastelandEcho.exe'
if (-not (Test-Path -LiteralPath $stagingExecutable)) { throw 'The staged Windows executable was not generated.' }
$stagingHash = (Get-FileHash -LiteralPath $stagingExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
Copy-Item -LiteralPath $stagingExecutable -Destination $executable -Force
if (-not (Test-Path -LiteralPath $executable)) { throw 'The Windows executable was not generated.' }
$sha = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
if ($sha -ne $stagingHash) { throw 'The final executable differs from the verified staged file.' }
Remove-Item -LiteralPath $stagingExecutable
if (@(Get-ChildItem -LiteralPath $stagingDirectory -Force).Count -eq 0) {
    Remove-Item -LiteralPath $stagingDirectory
}
$sourceCommit = (& git -C $workspaceDirectory rev-parse HEAD).Trim()
$manifest = [ordered]@{
    kind = 'internal-godot-preview'
    version = $version
    engine = '4.7.2.stable.official.ed1daf0bf'
    sourceCommit = $sourceCommit
    sourceDirty = -not [string]::IsNullOrWhiteSpace((& git -C $workspaceDirectory status --porcelain | Out-String))
    file = 'WastelandEcho.exe'
    bytes = (Get-Item -LiteralPath $executable).Length
    sha256 = $sha
    published = $false
}
Copy-Item -LiteralPath (Join-Path $workspaceDirectory 'godot/licenses/LICENSE-Godot.txt') -Destination (Join-Path $outputDirectory 'LICENSE-Godot.txt')
Copy-Item -LiteralPath (Join-Path $workspaceDirectory 'godot/licenses/COPYRIGHT-Godot.txt') -Destination (Join-Path $outputDirectory 'COPYRIGHT-Godot.txt')
$encoding = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $outputDirectory 'build-manifest.json'), ($manifest | ConvertTo-Json -Depth 4) + "`n", $encoding)
[IO.File]::WriteAllText((Join-Path $outputDirectory 'SHA256SUMS.txt'), "$sha  WastelandEcho.exe`n", $encoding)
$manifest | ConvertTo-Json -Depth 4
