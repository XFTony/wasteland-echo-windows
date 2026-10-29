@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch-Pilot.ps1" -Editor
if errorlevel 1 pause
