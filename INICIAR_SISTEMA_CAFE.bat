@echo off
setlocal
chcp 65001 >nul
title Sistema Cafe BH
cd /d "%~dp0"

echo.
echo ==========================================
echo       SISTEMA CAFE BH - DESKTOP
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao foi encontrado.
    echo Instale o Node.js LTS e execute este arquivo novamente:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (
    echo [ERRO] O projeto requer Node.js 20 ou superior.
    node --version
    pause
    exit /b 1
)

if not exist ".env" (
    echo [1/4] Criando configuracao local...
    copy /y ".env.example" ".env" >nul
    if errorlevel 1 goto :erro
) else (
    echo [1/4] Configuracao local encontrada.
)

if not exist "node_modules" (
    echo [2/4] Instalando componentes pela primeira vez...
    call npm.cmd ci
    if errorlevel 1 goto :erro
) else (
    echo [2/4] Componentes instalados.
)

echo [3/4] Preparando o banco de dados...
call npm.cmd run db:generate
if errorlevel 1 goto :erro
call npm.cmd run db:deploy
if errorlevel 1 goto :erro

echo [4/4] Abrindo o aplicativo...
echo Esta janela pode ser minimizada. O Sistema Cafe abrira em uma janela propria.
echo.
call npm.cmd run desktop
if errorlevel 1 goto :erro
exit /b 0

:erro
echo.
echo [ERRO] Nao foi possivel iniciar o Sistema Cafe.
echo Verifique a mensagem acima e tente novamente.
echo.
pause
exit /b 1
