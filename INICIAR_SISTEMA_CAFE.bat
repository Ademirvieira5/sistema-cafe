@echo off
setlocal
cd /d "%~dp0"
title Sistema Cafe

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo NPM nao foi encontrado.
  echo Reinicie o computador e tente novamente.
  pause
  exit /b 1
)

if not exist ".env" (
  >".env" echo DATABASE_URL="file:./dev.db"
)

powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto abrir

echo Preparando o Sistema Cafe...
call npm run db:generate
if errorlevel 1 goto erro

call npm run db:deploy
if errorlevel 1 goto erro

start "Sistema Cafe" /min cmd.exe /c "npm run dev >> .sistema-cafe.log 2>&1"

echo Iniciando. Aguarde...
for /L %%I in (1,1,60) do (
  powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto abrir
  timeout /t 1 /nobreak >nul
)

echo O sistema demorou para iniciar.
echo Consulte o arquivo .sistema-cafe.log nesta pasta.
pause
exit /b 1

:abrir
start "" "http://localhost:3000"
exit /b 0

:erro
echo.
echo Nao foi possivel preparar o Sistema Cafe.
echo Consulte as mensagens acima.
pause
exit /b 1
