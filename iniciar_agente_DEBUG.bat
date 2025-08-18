@echo off
echo Iniciando o agente de monitoramento...

REM O comando a seguir executa o script Python.
python agente.py

echo.
echo O script foi finalizado ou encontrou um erro.

REM O comando 'pause' impede que esta janela feche automaticamente.
pause