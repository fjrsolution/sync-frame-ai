@echo off
setlocal EnableExtensions DisableDelayedExpansion
title FrameSync AI - Launcher
pushd "%~dp0"
if errorlevel 1 goto failed
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-windows.ps1"
set "RESULT=%ERRORLEVEL%"
popd
if "%RESULT%"=="0" exit /b 0
:failed
echo.
echo Aplikasi belum berhasil dijalankan. Periksa pesan di atas dan folder logs.
echo Periksa internet dan ruang disk, lalu jalankan file ini kembali.
pause
exit /b 1
