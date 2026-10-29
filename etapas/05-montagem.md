# Etapa 5 · Montagem

Ordem (todos com `--projeto <p>`; no modo Finalização use o projeto do bloco):
1. **Corte + Finalização**: `build-edit.mjs --render` → `hf/assets/picture.mp4` + `voice.wav` (loudnorm 2 passes).
   **Finalização**: `finalizacao.mjs montar --bloco bN` já gera picture, voice e `edit.json` (não rodar build-edit).
2. `prepare-assets.mjs` → fontes/SFX do template, trilha (se `trilha.fonte`), transições, risers.
3. **Motor viral** (template com `motor: viral`): `build-comp-viral.mjs` → `index.html` (ver `04-plano-viral.md`; som em `05c-som-viral.md`).
   Motor clássico: `build-comp.mjs` → `index.html`, `layer-*.html`, `build/conform.json`, `build/beats.json`.
   - Sem `trilha.fonte` (trilha já mixada): não gera cama de música nem ducking.
   - `hook.x` vazio / sem trecho "hook": sem X vermelhos, sem zoom de hook.
4. Ducking (só com trilha separada): `carve.mjs --core <config carve_core>` — **rodar de novo sempre que regenerar o index.html**.
5. `cd <hf> && npx hyperframes@<pin> check` → 0 erros. Erros conhecidos que **não** bloqueiam:
   `multiple_root_compositions` (os `layer-*.html` das camadas DaVinci ficam ao lado do index) e avisos
   `studio_missing_editable_id`. Atenção a `font_family_without_font_face` e contraste.
6. `snapshot --at <momentos>` (1 folha com os pontos que mudaram), nunca quadro a quadro.

Receitas: `build-comp` copia só as usadas de `grafismos/vendor/` para `hf/compositions/components/`.
Receita nova → ver `grafismos/CATALOGO.md` ("Como adicionar").
