param([switch]$Editor)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$godotExe = 'D:\Godot\Godot_v4.7.2-stable_win64_console.exe'
$previousAppData = $env:APPDATA
if (-not (Test-Path -LiteralPath $godotExe)) { throw "Godot executable not found: $godotExe" }
Push-Location -LiteralPath $projectRoot
try {
    & node scripts/godot/prepare-pilot.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Pilot source preparation failed.' }
    $taskProfile = Join-Path $projectRoot 'output\godot-evaluation-2026-10-29\godot-profile'
    New-Item -ItemType Directory -Force -Path $taskProfile | Out-Null
    $env:APPDATA = $taskProfile
    & $godotExe --headless --path $PSScriptRoot --editor --import
    if ($LASTEXITCODE -ne 0) { throw 'Godot import failed.' }
    if ($Editor) { & $godotExe --editor --path $PSScriptRoot }
    else { & $godotExe --path $PSScriptRoot --rendering-method gl_compatibility }
} finally { $env:APPDATA = $previousAppData; Pop-Location }
