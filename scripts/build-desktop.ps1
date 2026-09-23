param(
  [switch]$SkipStage
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageInfo = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$gameVersion = $packageInfo.version

if (-not $SkipStage) {
  & npm.cmd run stage:desktop
  if ($LASTEXITCODE -ne 0) { throw "Desktop staging failed with exit code $LASTEXITCODE" }
}

$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
$installPath = $null
if (Test-Path -LiteralPath $vswhere) {
  $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
if (-not $installPath -and (Test-Path -LiteralPath "C:\BuildTools")) { $installPath = "C:\BuildTools" }
if (-not $installPath) {
  throw "Visual C++ Build Tools are required. Install the Desktop development with C++ workload, then rerun npm.cmd run build:desktop."
}

$devCmd = Join-Path $installPath "Common7\Tools\VsDevCmd.bat"
if (-not (Test-Path -LiteralPath $devCmd)) { throw "VsDevCmd.bat was not found under $installPath" }
$manifest = Join-Path $projectRoot "src-tauri\Cargo.toml"
$buildCommand = "`"$devCmd`" -no_logo -arch=x64 -host_arch=x64 && cargo.exe build --release --manifest-path `"$manifest`""
& cmd.exe /d /s /c $buildCommand
if ($LASTEXITCODE -ne 0) { throw "Tauri release build failed with exit code $LASTEXITCODE" }

$sourceExe = Join-Path $projectRoot "src-tauri\target\release\wasteland-echo.exe"
$releaseDir = if ($gameVersion -match "-") {
  Join-Path $projectRoot "output\builds\v$gameVersion"
} else {
  Join-Path $projectRoot "release"
}
$targetExe = Join-Path $releaseDir "WastelandEcho-v$gameVersion-win-x64.exe"
if (-not (Test-Path -LiteralPath $sourceExe)) { throw "Expected executable was not produced: $sourceExe" }
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force
Get-Item -LiteralPath $targetExe | Select-Object FullName, Length, LastWriteTime
