$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$configDirectory = Join-Path $projectRoot '.codex'
$configFile = Join-Path $configDirectory 'config.toml'
$server = (Join-Path $projectRoot 'tools\godot-mcp\node_modules\@coding-solo\godot-mcp\build\index.js').Replace('\','/')
$nodeCommand = (Get-Command node.exe).Source.Replace('\','/')
if (-not (Test-Path -LiteralPath $server)) { throw 'Install the locked tools/godot-mcp dependencies first.' }
New-Item -ItemType Directory -Force -Path $configDirectory | Out-Null
$current = if(Test-Path -LiteralPath $configFile){Get-Content -Raw -LiteralPath $configFile}else{''}
if ($current -match '\[mcp_servers\.wasteland_godot\]') { Write-Output 'Project Godot MCP already configured.'; exit 0 }
$addition = @"

[mcp_servers.wasteland_godot]
command = '$nodeCommand'
args = ['$server']
startup_timeout_sec = 30
tool_timeout_sec = 60
enabled_tools = ['get_godot_version', 'get_project_info', 'list_projects', 'create_scene', 'add_node', 'load_sprite', 'save_scene', 'get_uid', 'run_project', 'get_debug_output', 'stop_project']

[mcp_servers.wasteland_godot.env]
GODOT_PATH = 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe'
"@
[IO.File]::WriteAllText($configFile, $current + $addition + "`n", [Text.UTF8Encoding]::new($false))
Write-Output 'Configured wasteland_godot for this project. Reload the project session to refresh the host tool catalog.'
