@echo off
rem Arraste um ou mais videos/audios para este arquivo: sai .srt, .txt e .words.json ao lado de cada um.
rem Modelo large-v3: mais fiel, ~4x mais lento que o turbo.
chcp 65001 >nul
set HF_HUB_DISABLE_SYMLINKS_WARNING=1
set "PY=%USERPROFILE%\.cache\kodo\venv-transcricao\Scripts\python.exe"
if "%~1"=="" (echo Arraste o video para cima deste arquivo. & pause & exit /b 1)
"%PY%" "%~dp0..\scripts\transcrever.py" --modelo large-v3 %*
pause
