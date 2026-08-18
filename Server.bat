@echo off
rem Abre o jogo na janela propria (Electron). Fora do navegador o teclado inteiro
rem e do jogo: F1-F12, F5, Ctrl+W e Ctrl+T nao sao mais roubados.
rem Feche a janela do jogo para desligar. (tools\serve.py continua servindo pro
rem navegador, se voce quiser testar la: python tools\serve.py 8765)
cd /d "%~dp0"
if not exist node_modules\electron (
  echo Primeira vez: baixando o Electron ^(~100MB^)...
  call npm install
  if errorlevel 1 ( echo Falhou o npm install. & pause & exit /b 1 )
)
call npm start
if errorlevel 1 pause
