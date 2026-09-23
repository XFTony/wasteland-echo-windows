$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageInfo = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$gameVersion = $packageInfo.version

& npm.cmd run stage:desktop
if ($LASTEXITCODE -ne 0) { throw "Desktop staging failed with exit code $LASTEXITCODE" }

$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
$installPath = $null
if (Test-Path -LiteralPath $vswhere) {
  $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
if (-not $installPath -and (Test-Path -LiteralPath "C:\BuildTools")) { $installPath = "C:\BuildTools" }
if (-not $installPath) { throw "Visual C++ Build Tools are required" }

$devCmd = Join-Path $installPath "Common7\Tools\VsDevCmd.bat"
$tauriRoot = Join-Path $projectRoot "src-tauri"
$buildCommand = "`"$devCmd`" -no_logo -arch=x64 -host_arch=x64 && cd /d `"$tauriRoot`" && cargo.exe tauri build --bundles nsis"
& cmd.exe /d /s /c $buildCommand
if ($LASTEXITCODE -ne 0) { throw "Tauri NSIS build failed with exit code $LASTEXITCODE" }

$releaseDir = if ($gameVersion -match "-") {
  Join-Path $projectRoot "output\builds\v$gameVersion"
} else {
  Join-Path $projectRoot "release"
}
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$portableExe = Join-Path $releaseDir "WastelandEcho-v$gameVersion-win-x64.exe"
$builtExe = Join-Path $tauriRoot "target\release\wasteland-echo.exe"
if (-not (Test-Path -LiteralPath $builtExe)) { throw "Portable executable was not produced: $builtExe" }
Copy-Item -LiteralPath $builtExe -Destination $portableExe -Force
$installer = Get-ChildItem -LiteralPath (Join-Path $tauriRoot "target\release\bundle\nsis") -Filter "*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw "NSIS installer was not produced" }
$releaseInstaller = Join-Path $releaseDir "WastelandEcho-v$gameVersion-win-x64-setup.exe"
Copy-Item -LiteralPath $installer.FullName -Destination $releaseInstaller -Force

$portableZip = Join-Path $releaseDir "WastelandEcho-v$gameVersion-win-x64-portable.zip"
$releaseNotes = Join-Path $releaseDir "README-v$gameVersion.txt"
if (-not (Test-Path -LiteralPath $releaseNotes)) {
  $releaseNotes = Join-Path $projectRoot "docs\release-notes\README-v$gameVersion.txt"
}
if (-not (Test-Path -LiteralPath $releaseNotes)) { throw "Release notes were not found for v$gameVersion" }
Compress-Archive -LiteralPath $portableExe, $releaseNotes -DestinationPath $portableZip -CompressionLevel Optimal -Force

$artifacts = @($portableExe, $releaseInstaller, $portableZip)
$lines = foreach ($artifact in $artifacts) {
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($artifact)
  try {
    $hash = ([System.BitConverter]::ToString($hasher.ComputeHash($stream))).Replace("-", "")
  } finally {
    $stream.Dispose()
    $hasher.Dispose()
  }
  "$hash  $([IO.Path]::GetFileName($artifact))"
}
Set-Content -LiteralPath (Join-Path $releaseDir "SHA256SUMS.txt") -Value $lines -Encoding ascii
Get-Item -LiteralPath $artifacts | Select-Object FullName, Length, LastWriteTime
