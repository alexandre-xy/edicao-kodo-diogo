# Catálogo de receitas — motor viral (`grafismos/viral.mjs`)

Medido de um vídeo de referência. Todas leem cores/fontes do template
(`style.json` → `cores`, `tipografia`, `capitulo`, `ritmo`). Tempos por **índice de palavra** (`em`, `de`, `ate`).
Posições em px do contêiner: `ui` = canvas 1080×1920 · `meia` = painel 1080×960 · `cheia` = mundo 1080×1920.

| Receita | `tipo` | O que faz | `dados` |
|---|---|---|---|
| `circulos` | ui | pílula escura com N círculos numerados (vermelhos) que entram um a um — hook | `n`, `em[]` (palavra de cada círculo), `cor` ("erro"\|"acento"), `y` |
| `capitulo` | ui | indicador 1-2-3: o círculo ativo vira anel→branco; rótulo + título em serif (revelação L→R). Sem `titulo` = só progresso (fechamento) | `n`, `total`, `rotulo`, `titulo`, `em` |
| `slider` | ui | slider "A → B" que preenche com a fala; cursor arrasta o botão | `de`, `para`, `deEm`, `ateEm` |
| `icone-snap` | meia | ícone grande que encolhe (snap 0,1 s) + contorno, selo e partículas | `snapEm`, `selo` |
| `barra-segmentos` | meia | segmentos entram em sequência; só um acende em azul com halo | `n`, `luz`, `luzEm`, `rotulo` |
| `quadrados-cor` | meia | quadrados de cor com rótulo, um por palavra-chave | `itens:[{cor, rotulo, sub, em}]`, `y` |
| `cartao-foto` | cheia | cartão com imagem (ou placeholder) + câmera que acompanha o texto | `imagem`, `cartao:{x,y,w,h,rot}` (+ `blocos`, `camera` na cena) |
| `objeto-central` | cheia | regra dos 3 objetos: objeto central (imagem ou esfera) + 2 cartões de apoio + halo | `imagem`, `y`, `cartaA`, `cartaB`, `emA`, `emB`, `emHalo` |
| `chips-flutuantes` | cheia | chips (marcas/itens) que "pipocam" ao redor do texto central e flutuam | `itens:[{texto, x, y, em, estilo:"serif"\|"sans", tam, cor}]`, `saiEm` |
| `texto` | cheia | só legenda em modo claro (frase final) | — (use `blocos`) |

## Regras aprendidas (teste Viral_Teste)
- **Respiro**: chips/objetos fora da faixa do texto (≈ y 780–1300 no centro). Texto nunca encosta em chip.
- Tela cheia: texto ~1,2× (sans ≈ 50 px, serif ≈ 110 px) e bloco ≈ 940 px; meia tela e UI: texto padrão (42 px).
- Chips/logos de **marcas de terceiros** só com a marca do cliente/permissão; no teste usamos nomes fictícios.
- Objeto/foto do cliente entra por `dados.imagem` (dentro de `hf/assets/`); sem imagem, usa placeholder neutro.
- Cada animação é registrada com `anim()` (estado inicial = `from` da mais cedo) → seek-safe. Evitar tweens sobrepostos
  na mesma propriedade (o `check` avisa) e `transform` CSS em elemento animado (o `check` bloqueia).
- Para criar receita nova: copiar uma existente de `viral.mjs`, registrar em `REC`, testar com `snapshot`, documentar aqui.
