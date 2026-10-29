# Etapa 8 · Entrega + aprendizado

1. **Cópia leve** (a cada rodada de revisão): `cd <hf> && npx hyperframes@<pin> render . -q draft -f <fps> -o RENDERS/draft_vN_1080.mp4 --quiet > log 2>&1`
   (rodar em background) → `ffmpeg … scale=720:1280 … preview720_vN.mp4`. Medir loudness (`ebur128`).
2. **Render final** (só após revisão aprovada, e só se o piloto não for renderizar no DaVinci):
   `render --fps <fps> --quality delivery -o RENDERS/<nome>_vN_<W>x<H>.mp4`.
2b. **Checagem de entrega**: `node scripts/qa.mjs RENDERS/<nome>_vN_<W>x<H>.mp4 --w <W> --h <H> --fps <fps> --dur <s> --lufs <alvo>`
   (valores do `projeto.json → saida`). Reprovado = não entrega. Gera folha de 24 quadros + `qa.json` em `RENDERS/qa/`.
   Mais `node scripts/zona-segura.mjs build/layers/<camadas de texto>.mov --preset <reels|feed|youtube> --w <W> --h <H>`
   nas camadas finais (mesma regra: reprovado não entrega).
2c. **Ficha de decisões final** (`RENDERS/decisoes_final.md`): a da Etapa 4 atualizada com o que mudou na revisão +
   lista de cortes final. Vai junto com a entrega e alimenta a retrospectiva.
   Anexos para o PC pelo app: limite de 25 MB (mandar o 720p ou salvar direto na pasta).
3. **Pacote DaVinci** (`DAVINCI_PROJECT/saida/vN[_bloco]/`):
   - camadas alpha (background, uma por vez): `render -c layer-{panels,caps,end}.html --format mov -f <fps> -q draft -o build/layers/<x>.mov`
     (`layer-hook` só se houver hook).
   - `blur-original.mjs` só se houver `disfarce.areas`.
   - `build-fcpxml.mjs` → `<projeto>.fcpxml` + `media/` + `legendas.srt`. Modo Finalização: V1 = os clipes originais
     do editor, nos mesmos cortes (mídia remuxada sem timecode, nome ASCII).
   - Áudio: com trilha mixada, vai `audio_nivelado_14LUFS.wav` (ganho 0). Conferir antes: bruto, nivelado e render.
   - `LEIA-ME.txt` (importar: File › Import › Timeline; Relink para `media/`; o que o XML não leva: efeitos de áudio,
     cor, limiter do master) + `referencia_preview720.mp4`.
   - Validar: todas as mídias existem; PSNR do painel (camada × render) ≈ 35 dB; `check-fcpxml.mjs` (inconclusivo no
     1º uso — não confiar só nele; abrir no Resolve e conferir V1, a ordem das faixas e o ÁUDIO). Fluxo de volta ao Resolve
     VALIDADO no CLAUDE TEST 2 (cortes, rotação, áudio, motions, legendas).
4. Trocar algo depois (ex.: uma legenda): corrigir `projeto.json`, re-renderizar só a camada, recortar o clipe com o
   **mesmo nome/duração** e sobrescrever; no Resolve: Relink / Delete Render Cache.
5. **Retrospectiva**: o que o piloto corrigiu → `APRENDIZADOS.md`; receita aprovada → favoritas em `grafismos/CATALOGO.md`.

## Pacote DaVinci — MOTOR VIRAL (`motor: viral`)
1. `build-comp-viral.mjs` (gera `layer-{degrade,faixa,fundo,ui,caps}.html` + `build/conform.json` com câmera, camadas, música e SFX).
2. Camadas alpha (uma por vez; `fundo` é a mais pesada): `cd <hf> && for L in degrade faixa fundo ui caps; do npx hyperframes@<pin> render -c layer-$L.html --format mov -f <fps> -q draft -o build/layers/$L.mov; done`
3. `node scripts/build-fcpxml-viral.mjs --projeto <p>` → `DAVINCI_PROJECT/saida/<versão>/` (`.fcpxml`, `media/`, `legendas.srt`, `LEIA-ME.txt`);
   copiar `referencia_preview720.mp4`. V1 = mídias originais do editor nos cortes finais (precisa de `DATA/blocos.json` e do XML em `entrada/`).
4. STATUS: gerado e verificado estruturalmente (tags, soma das durações = sequência, lanes, formato retrato 2160×3840 p/ originais com rotação −90).
   **Ainda não validado importando no Resolve** — conferir V1, faixas e áudio; anotar aqui o que precisar de ajuste.
