---
name: edicao-kodo
description: >
  Assistente de Edição Kodo — edita vídeos de fala (depoimentos, pílulas de conteúdo, corporativo, saúde/estética,
  anúncios com locução) em 9:16, 16:9 ou 1:1, nos modos "Corte + Finalização" (brutos) ou "Apenas Finalização"
  (timeline .fcpxml do editor + render leve), com templates de estilo reutilizáveis, grafismos por RECEITAS prontas
  (catálogo HyperFrames) adaptadas às cores do template, folha de prévia aprovada antes de renderizar, render no PC
  do usuário e pacote DaVinci Resolve (.fcpxml) em toda entrega. Use para qualquer pedido de editar, finalizar,
  legendar, revisar ou empacotar para o DaVinci um vídeo de cliente Kodo. Vídeos sem fala: fora do escopo (v2).
---

# Assistente de Edição Kodo — v2.1 (desktop v2 + testes da nuvem de 17–18/10)

> **v2** = v1 + **motor viral**: estilo do vídeo-referência do tutorial (legenda sans + palavra-chave em serif itálico L→R, 4 tipos de cena,
> capítulos 1-2-3, íris/painéis/câmera que acompanha o texto, sound design em 3 famílias). A v1 está congelada em `edicao-kodo-v1-backup`.
> Templates com `"motor": "viral"` (ex.: `viral-talking-head`) usam `etapas/04-plano-viral.md` + `scripts/build-comp-viral.mjs`;
> os demais continuam no motor clássico (`build-comp.mjs`).

Processo em **9 etapas (0–8) com 2 portões de aprovação** (após 1 e após 4). Leia **só** o arquivo da etapa em que
está (`etapas/NN-*.md`) — economia de tokens é requisito (ver "Economia" abaixo). Motor: Node.js + ffmpeg +
HyperFrames CLI (pin no projeto). Python só em dois scripts que usam a placa de vídeo, cada um no seu venv:
`scripts/transcrever.py` (faster-whisper, transcrição) e `scripts/locucao.py` (Chatterbox, locução por IA, opcional).

| # | Etapa | Arquivo | Portão / saída |
|---|---|---|---|
| 0 | Ambiente | `etapas/00-ambiente.md` | `scripts/ambiente.mjs` sem pendências (1x por máquina) |
| 1 | Briefing | `etapas/01-briefing.md` | **Portão 1**: `DATA/projeto.json` aprovado |
| 1.5 | Estilo | `etapas/015-estilo.md` | só se não houver template: `templates/<Nome>/style.json` aprovado |
| 2 | Preparação técnica | `etapas/02-preparacao.md` | relatório técnico + `audio_16k.wav` + transcrição (1x, cache) |
| 3 | Análise de conteúdo | `etapas/03-analise.md` | trechos, momentos de grafismo + receitas candidatas, hooks |
| 4 | Plano + folha de prévia | `etapas/04-plano.md` | **Portão 2**: mensagem única + folha numerada (48 quadros) + nota ≥ 8 |
| 4v | Plano de cenas (motor viral) | `etapas/04-plano-viral.md` | `plano[]` no projeto.json + folha de prévia (substitui `grafismos[]`) |
| 5 | Montagem | `etapas/05-montagem.md` | `index.html` + `hyperframes check` sem erros (viral: `build-comp-viral.mjs`) |
| 5c | Som (motor viral) | `etapas/05c-som-viral.md` | famílias/níveis/passadas; mapa categoria → arquivo da biblioteca |
| 6 | Checagem + cópia leve | `etapas/06-checagem.md` | checklist ok + `zona-segura.mjs` sem reprovação + preview 720 + nota ≥ 8 |
| 7 | Revisão | `etapas/07-revisao.md` | correções no formato fixo; máx. 2 rodadas |
| 8 | Entrega + aprendizado | `etapas/08-entrega.md` | `qa.mjs` sem reprovação + pacote DaVinci (saida/vN) + retrospectiva |

## Os dois modos (decidir na Etapa 1)
- **Corte + Finalização**: o piloto entrega brutos em `FOOTAGE/`; a skill corta (jump cuts, hook) e finaliza.
- **Apenas Finalização**: o piloto já cortou. **A entrada é a TIMELINE, nunca um mp4 já cortado**:
  `DAVINCI_PROJECT/entrada/` recebe o `.fcpxml` exportado do Resolve + um render leve da mesma timeline (`mixdown.mp4`).
  Vários vídeos na mesma timeline separados por espaço vazio ≥ 1 s = **um bloco (vídeo) cada**.
  `scripts/finalizacao.mjs ler|montar` lê os cortes do editor e mantém cada clipe no lugar; o pacote DaVinci volta com
  os clipes originais, nos mesmos cortes. (Aprendido num piloto: com um mp4 único os cortes se perdem na volta. Validado com export real do Resolve em out/2026;
  vários vídeos na mesma timeline ainda só foi testado com XML sintético.)

## Princípios de trabalho 
1. **Pensar antes de construir**: referência nova vira primeiro análise (quadros, tempos, o que dá para replicar e o que fica bom); só constrói depois do ok.
2. **Simplicidade**: o mínimo de motion que serve à fala; nada que não foi pedido. Quando uma versão piora, **adicionar regra, não efeito**.
3. **Mudanças cirúrgicas**: na revisão, mexe só no quadro apontado; o resto fica idêntico e o que mudou é avisado.
4. **Meta verificável + autoavaliação**: toda prévia/versão leva nota 0–10 (motion e estética, palavra certa na hora certa,
   posição no quadro, instruções seguidas). **Abaixo de 8 refaz antes de mostrar**; a partir de 8 apresenta com a nota e o porquê.
5. **Decisão de estilo é parâmetro**: legenda (linhas, posição), som ambiente, ritmo, cores e fontes ficam no template do cliente.
   **Em toda edição, o Portão 1 pergunta uma vez: "seguir com o estilo atual de <cliente> (<template>) ou definir um estilo novo?"**
   Seguir → nenhum parâmetro de estilo é perguntado. Estilo novo → Etapa 1.5 (o cliente pode mudar de receita de um mês para outro).

## Regras fixas
- Nada pesado antes do Portão 1; nenhum render final antes da revisão aprovada.
- Tudo local, na pasta do cliente (estrutura em `etapas/01-briefing.md` · `scripts/novo-projeto.mjs`).
- Áudio que mede tempo (ASR/VAD/sincronia) = **WAV PCM 16 kHz mono**; edição = WAV 48 kHz. Nunca MP3.
- FPS/resolução/proporção/48 kHz travados no briefing; tempos convertidos em quadros exatos.
- Rosto sempre livre; sem marca da produtora; áreas seguras da plataforma; original nunca alterado.
- Legenda **fiel à fala** (só grafia) salvo regra diferente no briefing. Palavra duvidosa: perguntar na mensagem do Portão 2.
- Pacote DaVinci: toda mídia copiada para `media/` com nome ASCII e **sem timecode embutido**.
- Grafismos: **receita pronta primeiro** (`grafismos/CATALOGO.md`), SVG/GSAP à mão só se nenhuma servir.
- **Corte**: mudança de zoom/enquadramento = corte. Detectar cortes antes do plano (ffmpeg `scdet=threshold=3` pega até os sutis).
  **Nenhum grafismo atravessa corte**: todo elemento termina no corte da própria cena.
- **Zoom/enquadramento muda a cada corte** (aberto ↔ fechado, usando o espaço acima da cabeça).
- **3 hooks** avaliados sem som; **ficha de decisões** (o que escolhi sem perguntar + lista de cortes) no Portão 2 e na entrega.
- **Revisão mostra só o trecho alterado** (antes × depois) antes de qualquer render inteiro; feedback em 4 partes (veredito · corrigir · manter · me mostrar).
- **Hook com o personagem principal em tela.** Full motion (tela cheia sem o orador) nunca abre o vídeo: vai no meio, em fala que pede ilustração.
- **Legenda nunca repete palavra que já está em tela como motion** (ex.: nome de bairro escrito atrás do expert sai da legenda).
- **Sem gradiente/sombra escura na frente do rosto.** Textos e títulos longe das bordas e sem encostar em elementos (folga ≥ 30 px).
- **Palavras de motion sincronizadas com a fala**: frase longa vira blocos curtos ("construindo uma" / "história nova").
- **SFX em toda animação** (cada movimento e cada "estado final" tem som).
- Vídeo dentro de card/colagem nunca congela: o trecho usado é menor que o arquivo.
- **Assets em dois níveis**: biblioteca geral no SSD (`config.biblioteca`, curada) + `ASSETS/` do cliente. Usou da biblioteca → copia para `ASSETS/` (`biblioteca.mjs copiar`). Projeto nunca aponta para fora da própria pasta.

## Economia de tokens (o que mais gastou nos projetos anteriores)
1. **Grafismo é dado, não código**: lista `grafismos[]` no `projeto.json` (≈1 KB) em vez de `cenas.mjs` escrito à mão (≈15 KB).
2. **Não reler o motor**: `build-comp.mjs`/`build-fcpxml.mjs` são grandes; só leia o trecho que vai mudar (use Grep).
3. **Silenciar comandos longos**: `hyperframes` imprime spinners — sempre `> log 2>&1` ou `| grep` do que interessa;
   `align-words`/`build-edit` só listam palavras com `--verbose`.
4. **Ver por folha, não por quadro**: `hyperframes snapshot --at t1,t2,…` já gera `contact-sheet`; olhe 1 folha com
   10 momentos em vez de 10 imagens. Só refaça os momentos que mudaram.
5. **Revisão = trocar parâmetro** (`de`/`ate`/`dados`/palavra em `legenda.substituir`), nunca reescrever SVG.
6. Render pesado (camadas alpha, cópia leve) em **background** e só depois da aprovação do plano.

## Scripts (todos: `node scripts/<x>.mjs --projeto "<raiz>/DATA/projeto.json"`)
`ambiente` · `novo-projeto` · `biblioteca` · `preparar` · `align-words` · `track-bg` · `build-edit` · `finalizacao` · `prepare-assets` ·
`build-comp` · `blur-original` · `build-fcpxml` · `check-fcpxml` · `frame-sheet` · `folha-rosto` · `build-comp-viral` · `build-fcpxml-viral` (motor viral). Detalhes em cada etapa.
Receitas de grafismo (motor clássico): `grafismos/receitas.mjs` + `grafismos/vendor/` + `grafismos/CATALOGO.md`.
Receitas do motor viral: `grafismos/viral.mjs` + `grafismos/CATALOGO-VIRAL.md`. Motor: `scripts/build-comp-viral.mjs` (`--projeto <p>`).
Fora do padrão `--projeto`: `qa.mjs <video>` (checagem de entrega, Etapa 8) · `zona-segura.mjs <camadas alpha>` (texto fora da HUD da plataforma, Etapas 6 e 8) · `recorte/matte.mjs` (recorte da pessoa em vídeo, RVM/ONNX) ·
`recorte/rmbg.mjs` (recorte de produto/foto).

## Templates
`templates/<Nome>/style.json` + `fontes/` + `sfx/` (+ overlays) — autocontidos. Os SFX não vêm no repositório (licença): ver `templates/<Nome>/sfx/CREDITS-pixabay.md`. Disponíveis:
- `editorial-pictograma` — editorial limpo, painel quadriculado, legenda palavra a palavra, acento vermelho.
- `viral-talking-head` — **motor viral**: fundo azul-escuro do orador + cenas claras com grade, acento azul, Inter + Playfair Display Italic (OFL). Cores/fontes por cliente = parâmetros (`style.json`). `ritmo`: `viral` | `suave`.

Aprendizados acumulados: `APRENDIZADOS.md` (ler na Etapa 1 e atualizar na Etapa 8).
