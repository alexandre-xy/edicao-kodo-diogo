# Etapa 6 · Checagem automática + cópia leve

Checklist (tudo precisa passar antes de mandar ao piloto):
- **Nota 0–10 da versão** (mesmos critérios da Etapa 4). < 8 → corrigir antes de mandar. SFX e bounce só se avaliam no vídeo, não na folha.
- Nenhum grafismo depois do corte da cena dele; nenhuma sombra/gradiente sobre o rosto; textos longe das bordas.
- `hyperframes check` 0 erros · rosto livre (folha) · contraste da legenda.
- **Área segura automática, em todos os quadros**: renderizar as camadas de texto/motion com alpha (são leves; motor
  clássico `layer-caps`/`layer-panels`, viral `layer-caps`/`layer-ui`) e rodar
  `node scripts/zona-segura.mjs build/layers/caps.mov build/layers/ui.mov --preset reels --w <W> --h <H>`
  (presets: `reels` 9:16 = topo 220 · base 420 · esq 60 · dir 150 px em 1080; `feed`; `youtube`; ajustar com `--topo/--base/--esq/--dir`).
  Só camadas de texto/objetos: fundo, degradê e cenas de tela cheia ficam fora (cobrem a tela toda e sempre reprovariam).
  REPROVADO = mover o elemento antes de mandar; o script salva o pior quadro com as faixas em vermelho.
- Legenda × transcrição: texto fiel à regra do briefing; nenhum bloco depois do cartão final; sem `NaN` em tempos.
- Loudness do render: integrado ≈ alvo, pico ≤ −1 dBTP (ffmpeg `ebur128`); trechos críticos (hook, picos de SFX).
- Assets: todos os `src` existem; transições sem timecode.
Render leve: `npx hyperframes@<pin> render --fps <fps> -q draft -o RENDERS/<nome>_vN_draft.mp4` →
`ffmpeg … scale=720:-2 … RENDERS/<nome>_vN_preview_720.mp4` (< 30 MB) +
`frame-sheet.mjs <render> --beats <hf>/build/beats.json --out RENDERS/<nome>_vN_sheet.jpg` (folha **numerada, tempos da versão**).
