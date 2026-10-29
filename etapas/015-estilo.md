# Etapa 1.5 · Estilo (só quando nenhum template serve)

Entrada: arquivos em `REFS/` (manual de marca PDF, fontes .ttf/.otf, prints, vídeos de referência) **+ instrução
diretiva do piloto** (ex.: "cores do manual, legenda e SFX deste vídeo do TikTok").

0. **O que o piloto manda** (nada além disso): os MP4 originais baixados pelo link (ex.: cobalt.tools; gravação de tela só
   em último caso, perde resolução) em `REFS/` + **uma nota curta por vídeo**: o que gostou e onde (`0:15 transição de máscara`).
   Opcional: `REFS/diagnostico-externo.txt` (ex.: análise do Gemini, que ouve o áudio). Não pedir prints, docx nem
   transcrição: a skill extrai quadros, mede tempos e transcreve sozinha. O diagnóstico externo é **hipótese**: o que a
   skill mede nos quadros vale mais; usar o externo principalmente para som (SFX, música), que a skill não ouve.
1. Vídeos de referência → `frame-sheet.mjs --scenes` (folha de cortes) + medir ritmo (cortes/min), duração média de plano.
2. Extrair: paleta (hex), tipografia (primária/legenda), legenda (tamanho, peso, cor-chave, pop), motion
   (nomes de ease GSAP + durações em ms — ex. `back.out(1.6)` 180 ms "snappy"; `sine.inOut` 900 ms "smooth"),
   texturas/fundos, densidade de eventos (eventos visuais/seg; 1 SFX por evento), transições, nível de SFX.
3. PDF de manual: extrair texto/cores com ferramenta de PDF disponível (sem Python neste PC — usar Node ou pedir hex ao piloto).
4. Montar `templates/<Nome>/` **autocontido**: `style.json` (mesmo esquema de `editorial-pictograma`), `fontes/` (copiar +
   checar licença), `sfx/`, overlays. Nunca apontar para a REFS do cliente.
5. Folha de amostra (HyperFrames snapshot de um rascunho com o estilo) → **aprovação** → template salvo.
