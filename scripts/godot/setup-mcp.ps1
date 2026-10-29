$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskOut = Join-Path $projectRoot 'output\godot-evaluation-2026-10-29'
$localInstall = Join-Path $taskOut 'mcp'
New-Item -ItemType Directory -Force -Path $taskOut | Out-Null
& npm.cmd install --prefix $localInstall --ignore-scripts --no-audit --no-fund --cache (Join-Path $taskOut 'npm-cache') '@coding-solo/godot-mcp@0.1.1'
if ($LASTEXITCODE -ne 0) { throw 'Isolated MCP installation failed.' }
$server = (Join-Path $localInstall 'node_modules\@coding-solo\godot-mcp\build\index.js').Replace('\','/')
$nodeCommand = (Get-Command node.exe).Source.Replace('\','/')
$profile = (Join-Path $taskOut 'godot-profile').Replace('\','/')
$config = @"
# Prepared example only; this file is not automatically loaded by Codex.
[mcp_servers.godot_pilot]
command = '$nodeCommand'
args = ['$server']
enabled_tools = ['get_godot_version', 'get_project_info', 'list_projects', 'create_scene', 'add_node', 'load_sprite', 'get_uid', 'run_project', 'get_debug_output', 'stop_project']

[mcp_servers.godot_pilot.env]
GODOT_PATH = 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe'
APPDATA = '$profile'
"@
$config | Set-Content -LiteralPath (Join-Path $taskOut 'codex-mcp.example.toml') -Encoding utf8
Write-Output 'Prepared isolated MCP and configuration example. Codex global/project settings were not changed.'
