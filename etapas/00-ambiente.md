# Etapa 0 · Ambiente (1x por máquina)

Rodar: `node scripts/ambiente.mjs [--pin 0.8.162]` → lista o que falta e o comando para resolver. Não segue sem tudo ✔.

| Item | Como instalar (validado no piloto, Windows) |
|---|---|
| Node ≥ 20 | já exigido pelo Claude Code |
| ffmpeg + ffprobe no PATH | `winget install Gyan.FFmpeg` |
| HyperFrames CLI (pin) | `npx --yes hyperframes@<pin> --version` (cache do npx) |
| Python 3.11 | `winget install Python.Python.3.11` (escopo do usuário) |
| Transcrição na GPU (faster-whisper) | placa NVIDIA. `py -3.11 -m venv ~/.cache/kodo/venv-transcricao` e, nele, `pip install faster-whisper nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"` (config `python_transcricao`). Modelos (turbo ~1,6 GB, large-v3 ~3 GB) baixam na 1ª vez em `~/.cache/huggingface` |
| Locução por IA (Chatterbox) — opcional | `py -3.11 -m venv ~/.cache/kodo/venv-voz`; nele `pip install chatterbox-tts` e depois `pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124 --force-reinstall` (config `python_voz`) |
| whisper.cpp (reserva para PC sem placa NVIDIA) | binário oficial ggml-org `whisper-bin-x64.zip` (release b5454) em `~/.cache/hyperframes/whisper/` + variável `HYPERFRAMES_WHISPER_PATH` apontando para `whisper-cli.exe` (sem cmake no Windows a CLI não compila) |
| Modelo Whisper large-v3 | baixa sozinho na 1ª transcrição (~3 GB) em `~/.cache/hyperframes/whisper/models` |
| Parakeet TDT 0.6B v3 | `npx hyperframes models install parakeet` (~640 MB) |
| `@hyperframes/core` (carve) | `npm i --prefix "~/.cache/hyperframes/corepkg" @hyperframes/core@<pin>` (config `carve_core`); o `carve.mjs` recebe `--core <carve_core>` |
| Recortes (opcional) | `scripts/recorte/LEIA-ME.md` (onnxruntime-node + rvm.onnx; @imgly/background-removal-node) |
| Fontes do template | já vêm dentro de `templates/<Nome>/fontes/` |
| DaVinci Resolve Studio 21 | (do usuário) — só para importar o pacote |

| SSD de trabalho | projetos em `raiz_projetos` e biblioteca em `biblioteca` (config). Criar `config.local.json` com os caminhos deste PC (mesmas chaves do `config.json`) |

Custo: ~4 GB de download na 1ª vez (+~3 GB da transcrição na GPU, +~5 GB da locução, se instalar). Depois, zero.

**Onde fica cada coisa**: skill = GitHub (clonada em `~/.claude/skills/edicao-kodo`; `git pull` antes de usar) ·
ferramentas = cada PC (`~/.cache/hyperframes`) · trabalho = SSD (projetos de cliente + biblioteca).

**Atalhos (Windows)**: `atalhos/Transcrever.bat` (turbo) e `atalhos/Transcrever (preciso).bat` (large-v3). Criar atalho deles
na Área de Trabalho; arrastar o vídeo em cima → `.srt` (blocos curtos, pronto para o DaVinci), `.txt` e `.words.json` ao lado
do vídeo. Fechar o DaVinci antes deixa mais rápido (os dois disputam a placa).
