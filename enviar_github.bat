@echo off
setlocal
color 0A
title Atualizador do GitHub para o Painel IFPR

echo =======================================================
echo    ATUALIZADOR DO GITHUB - PAINEL DE MONITORAMENTO
echo =======================================================
echo.

if not exist .git (
    echo ERRO: Este diretorio nao parece ser um repositorio Git.
    pause
    exit /b
)

echo Adicionando todos os arquivos para o commit...
git add .
echo.

set /p commitMessage="Digite a mensagem do commit: "
if not defined commitMessage set commitMessage=Atualização de rotina - %date% %time%
echo.

echo Realizando o commit com a mensagem: "%commitMessage%"
git commit -m "%commitMessage%"
echo.

echo Enviando atualizações para o GitHub...
git push

REM Verifica se o comando anterior (git push) falhou
if errorlevel 1 (
    echo.
    echo ###############################################################
    echo #   ERRO: A transferencia para o GitHub falhou.             #
    echo #   Verifique as mensagens de erro acima.                   #
    echo #   Se for a primeira vez, execute o comando manualmente:   #
    echo #   git push --set-upstream origin master                   #
    echo ###############################################################
) else (
    echo.
    echo =======================================================
    echo    ATUALIZACOES ENVIADAS COM SUCESSO!
    echo =======================================================
)

echo.
pause