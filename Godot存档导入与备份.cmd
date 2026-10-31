@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not defined GODOT_PATH set "GODOT_PATH=D:\Godot\Godot_v4.7.2-stable_win64.exe"
if not exist "%GODOT_PATH%" (
  echo 未找到 Godot。请确认引擎仍位于 D:\Godot，或设置 GODOT_PATH。
  pause
  exit /b 1
)
if not exist "%~dp0godot\.godot\global_script_class_cache.cfg" (
  echo 请先运行一次“启动Godot开发版.cmd”，完成素材准备。
  pause
  exit /b 1
)
start "" "%GODOT_PATH%" --path "%~dp0godot" res://scenes/tools/save_transfer.tscn
