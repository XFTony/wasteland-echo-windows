param(
    [string]$GodotPath = $env:GODOT_PATH
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workspaceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ([string]::IsNullOrWhiteSpace($GodotPath)) {
    $GodotPath = 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe'
}
$outputDirectory = Join-Path $workspaceDirectory 'output/godot-migration/windows'
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
& $GodotPath --headless --path (Join-Path $workspaceDirectory 'godot') --export-release 'Windows Desktop' *> $logPath
$exportExit = $LASTEXITCODE
$log = [IO.File]::ReadAllText($logPath)
if ($exportExit -ne 0 -or $log -match '(SCRIPT ERROR|ERROR):') { throw "Godot export failed; inspect $logPath" }
$executable = Join-Path $outputDirectory 'WastelandEcho.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'The Windows executable was not generated.' }
$sha = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
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
