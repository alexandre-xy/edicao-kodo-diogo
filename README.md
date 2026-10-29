# edicao-kodo

Skill de edição de vídeo para o Claude Code (HyperFrames + ffmpeg + Node, entrega em FCPXML para o DaVinci Resolve).
Edita vídeos de fala (depoimentos, pílulas, corporativo, anúncios) em 9:16, 16:9 ou 1:1, com prévia aprovada antes de renderizar.

## Instalar
1. Clonar este repositório em `~/.claude/skills/edicao-kodo` (no Windows: `C:\Users\<usuário>\.claude\skills\edicao-kodo`).
2. Abrir o Claude Code e pedir: "roda a etapa 0 da edicao-kodo". Ele confere o que falta (Node, ffmpeg, HyperFrames, transcrição) e diz como instalar.
3. Ajustar `raiz_projetos` e `biblioteca` em `config.json` (ou criar `config.local.json` com as mesmas chaves).
4. Baixar os SFX dos templates: ver `templates/<nome>/sfx/LEIA-ME.md`.

## Usar
No Claude Code: `/edicao-kodo` ou "edita o vídeo X com a skill edicao-kodo".

- Ponto de entrada: `SKILL.md` (etapas 0–8 em `etapas/`, lidas uma por vez).
- Estilos: `templates/<nome>/` · receitas de grafismo: `grafismos/` · scripts: `scripts/`.
- O que já foi aprendido em projetos reais: `APRENDIZADOS.md`.

## Licenças de terceiros
- Fontes: OFL (arquivos de licença dentro de cada `fontes/`).
- `scripts/qa.mjs`: adaptado de Mort1d/motion-graphics-skills (MIT, `scripts/LICENSE-mort1d.txt`).
- `referencias/taste-skill-extraido/`: MIT (`LICENSE-taste-skill.txt`).
- `grafismos/vendor/`: componentes do catálogo HyperFrames.
