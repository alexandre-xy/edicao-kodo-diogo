# Etapa 2 · Preparação técnica (1x por projeto, tudo em cache em DATA/)

`node scripts/preparar.mjs --projeto <p>` → `DATA/relatorio_tecnico.json` + `DATA/transcricao/audio_16k.wav`.
Ordem (cada passo depende do anterior):

1. **Inspeção** (ffprobe): resolução, fps real × médio (**VFR**), codec, cor (**HDR**), áudio, duração, timecode.
2. **Conformar** se preciso: VFR → CFR no fps do projeto; HDR → SDR/tonemap (cópia em `DATA/cache/`). *(não validado)*
3. **Áudio externo** (lapela): sincronizar por forma de onda. *(não validado)*
4. **VAD** (A-roll × B-roll) com vários arquivos. *(não validado)*
5. **WAV 16 kHz mono** → `DATA/transcricao/audio_16k.wav` (do mixdown, no modo Finalização).
6. **Transcrever 1x**, **um comando por vez, saída para log** (o spinner do hyperframes enche o contexto):
   ```
   cd DATA/transcricao
   "<config python_transcricao>" <skill>/scripts/transcrever.py audio_16k.wav --modelo large-v3 --json-whisper whisper_large-v3.json > transcrever.log 2>&1
   npx hyperframes@<pin> transcribe audio_16k.wav -e parakeet >/dev/null 2>&1 ; mv transcript.json parakeet.json
   ```
   faster-whisper na placa de vídeo (RTX 4060: 10 min de áudio em ~4 min no large-v3, ~40 s no turbo; na CPU eram ~12 min).
   Aqui vale o large-v3, que é o texto da legenda. Depois `node scripts/align-words.mjs`
   (texto Whisper + tempos Parakeet + travado nos silêncios) → `hf/build/words.json`. Whisper sozinho erra até 0,6 s.
   Sem placa NVIDIA: o caminho antigo, `HYPERFRAMES_WHISPER_PATH="<config whisper_cli>"` +
   `npx hyperframes@<pin> transcribe audio_16k.wav -e whisper -m large-v3 -l pt` e renomear `transcript.json` → `whisper_large-v3.json`.
   **Nunca transcrever no DaVinci**: para só tirar um .srt de um vídeo, arrastar no atalho `Transcrever.bat` (Etapa 0).
7. **Câmera fixa?** `node scripts/track-bg.mjs <t1> <t2>…` — se deslocar, o disfarce de logos precisa de rastreio.
8. Se houver logo/texto de terceiros no fundo: `disfarce.areas`. Olhe 1 quadro do bruto antes (ffmpeg -ss 20 -frames:v 1).

## Modo Finalização (timeline do editor)
- `fonte.video` = o mixdown. Transcrever o mixdown INTEIRO (tempos = tempos da timeline) e alinhar.
- `node scripts/finalizacao.mjs ler --projeto <p>` → `DATA/blocos.json` (lista de vídeos/blocos com clipes e tempos).
- Por bloco: `node scripts/finalizacao.mjs montar --projeto <p> --bloco b1` → cria `DATA/blocos/b1/`
  (projeto.json próprio, hf com picture/voice nivelada, edit.json com os cortes do editor). Os próximos scripts
  rodam com `--projeto DATA/blocos/b1/projeto.json`.

Saída: relatório de 1 página (técnico + pendências) para o piloto.
