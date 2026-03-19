@echo off
setlocal

cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker is not installed or not in PATH.
  echo Install Docker Desktop and try again.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker daemon is not running.
  echo Start Docker Desktop, wait until it is ready, then run this script again.
  exit /b 1
)

echo Starting Invoice App containers...
docker compose up -d --build database backend frontend
if errorlevel 1 (
  echo [ERROR] Failed to start containers.
  exit /b 1
)

set "APP_PORT=9002"
set "LAN_NAME=%COMPUTERNAME%"

for /f %%I in ('powershell -NoProfile -Command "$ip=(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq ''Up'' } ^| Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress; if($ip){$ip}"') do set "LAN_IP=%%I"

echo.
echo Invoice App is running.
echo Use this URL on your other devices (same Wi-Fi):
echo   http://%LAN_NAME%:%APP_PORT%
if defined LAN_IP (
  echo Fallback if hostname does not resolve:
  echo   http://%LAN_IP%:%APP_PORT%
)
echo.
echo Tip: If hostname URL fails on a device, add a hosts entry there:
if defined LAN_IP (
  echo   %LAN_IP%  %LAN_NAME%
)
echo.
pause

