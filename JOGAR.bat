@echo off
rem Abre o jogo por HTTP. Duplo clique em index.html serve o arquivo por file://,
rem e ai o navegador bloqueia o fetch dos sons e da trilha (cai no sintetizado).
rem Feche esta janela para desligar o servidor.
cd /d "%~dp0"
rem ping como espera: timeout /t reclama quando a entrada nao e um console
start "" /b cmd /c ping -n 3 127.0.0.1 ^>nul ^& start "" http://localhost:8765/
rem serve.py = http.server + no-store: sem isso o navegador serve o JS antigo
python tools\serve.py 8765
pause
