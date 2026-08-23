@echo off
rem Abre o JOGO e o EDITOR DE MAPAS lado a lado, numa so janela de trabalho.
rem
rem Este e o arquivo para clicar. O tools\editor.html sozinho NAO funciona por
rem duplo clique: navegador nao deixa pagina abrir arquivo local nem subir
rem servidor, e o editor precisa das duas coisas -- ler o mapa e gravar o patch.
rem Quem faz esse trabalho e o launcher (main.js), que ja e um servidor Node.
rem
rem Edita, grava (Ctrl+S), e o jogo ao lado se atualiza sozinho. Sem terminal,
rem sem python, sem rodar node na mao. F9 dentro do jogo tambem abre o editor.
cd /d "%~dp0"
if not exist node_modules\electron (
  echo Primeira vez: baixando o Electron ^(~100MB^)...
  call npm install
  if errorlevel 1 ( echo Falhou o npm install. & pause & exit /b 1 )
)
call npx electron . --editor
if errorlevel 1 pause
