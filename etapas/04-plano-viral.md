# Etapa 4 (motor viral) · Plano de cenas + folha de prévia — PORTÃO 2

Use quando `template` tem `"motor": "viral"` (ex.: `viral-talking-head`). Substitui `grafismos[]` por **`plano[]`**
(cenas) e usa `scripts/build-comp-viral.mjs` no lugar de `build-comp.mjs`. Referência de estilo/medidas:
os parâmetros do template `viral-talking-head`.

## 1. Montar o plano (uma linha do roteiro → um tipo de cena)
Ler `words.json`/`edit.json` (índices de palavra) e classificar o roteiro. **Quem decide é o gosto do piloto**; sugerir:

| Tipo (`tipo`) | Orador | Quando usar | Receitas |
|---|---|---|---|
| (implícito) legenda | tela cheia | frases de ligação, emoção, "Less is more" | — (só legenda; chaves em serif) |
| `ui` | tela cheia, escurecido embaixo | hook, mudança de tópico, capítulos | `circulos`, `capitulo`, `slider` |
| `meia` | metade de baixo (recorte mais fechado) | explicar um conceito com um objeto/UI | `icone-snap`, `barra-segmentos`, `quadrados-cor` |
| `cheia` | some (legenda continua) | 2–3 momentos de maior impacto por vídeo | `cartao-foto`, `objeto-central`, `chips-flutuantes`, `texto` |

Ritmo-alvo: uma mudança visual a cada **3–5 s**; `cheia` ≤ 3×; capítulo (UI) antes de cada bloco do roteiro; fechamento com `capitulo`
sem título (todos acesos). Rosto nunca coberto; UI sempre abaixo do queixo.

## 2. Formato de `plano[]` (em `DATA/projeto.json`)
```json
"ritmo": "viral",                      // "viral" (rápido, 0,15–0,27 s) | "suave" (0,35–0,8 s); padrão: do template
"legenda": { "chaves": [1, 2, "36-37"], "substituir": { "157": "high-end", "158": null }, "pontuacao": {}, "capitalizar": true },
"plano": [
  { "tipo": "ui", "receita": "circulos", "de": 0, "ate": 9, "dados": { "n": 3, "em": [1, 2, 3] } },
  { "tipo": "ui", "receita": "capitulo", "de": 27, "ate": 30, "semLegenda": true,
    "dados": { "n": 1, "total": 3, "rotulo": "Number 1:", "titulo": "Stop oversizing everything", "em": 29 } },
  { "tipo": "cheia", "receita": "cartao-foto", "de": 32, "ate": 45, "maxChars": 44, "quebras": [38, 42],
    "dados": { "imagem": "assets/foto.png", "cartao": { "x": 640, "y": 1080, "w": 380, "h": 700, "rot": -2 } },
    "blocos": [ { "x": 540, "y": 420, "larg": 940 }, { "x": 560, "y": 1640, "larg": 900 } ],
    "camera": [ { "em": 40, "y": -720 } ] },
  { "tipo": "meia", "receita": "icone-snap", "de": 46, "ate": 70, "dados": { "snapEm": 61, "selo": "−25%" } }
]
```
- `de`/`ate` = índices de palavra; `antes` (0,12 s) e `depois` (0,15 s) ajustam a janela. Entre cenas o vídeo fica em "legenda".
- `legenda.chaves`: índices (ou `"a-b"`) das palavras em **serif itálico azul**. Regra: 1–3 palavras por frase, as que "prendem".
- `semLegenda: true` nas cenas em que o gráfico JÁ é o texto (capítulos).
- `blocos[k]` = posição (x, y, larg) do k-ésimo bloco de legenda da cena (só `cheia`); com `camera` o mundo anda e as legendas vão junto.
- `camera[]`: `{ em|t, x, y, escala, dur }` — movimento do "mundo" da tela cheia (ease in/out 0,45 s): a câmera acompanha o texto.
- `quebras`: índices em que o bloco de legenda é forçado a quebrar; `maxChars`: limite do bloco (padrão do template: 66); `escalaTexto`.
- `entrada`: `iris` (círculo; padrão legenda/ui→cheia), `wipe` (painel branco do topo; padrão meia→cheia), `corte`, `painel` (meia).
- Textos de capítulo/rótulos são **gráficos** (podem ser reescritos); a legenda normal continua **fiel à fala**.
- Cada receita tem seus `dados`: `grafismos/CATALOGO-VIRAL.md`.

## 3. Rodar e conferir
`prepare-assets.mjs` → `build-comp-viral.mjs` → `cd hf && npx hyperframes@<pin> check` (0 erros) →
`snapshot --at <48 momentos> --no-end` (1 folha numerada de 48 quadros) — comparar com os quadros do vídeo de referência. Render:
`npx hyperframes@<pin> render --fps <fps> --quality standard` (~2 min para 1 min de vídeo; `draft` p/ iterar).

## 4. Portão 2
Autoavaliação (nota 0–10, < 8 refaz — ver `04-plano.md`). Mensagem única ao piloto com a nota: plano (tabela cena → receita → tempos), folha de prévia, perguntas (palavras-chave, textos de
capítulo, imagens/objetos que precisa fornecer, marca/logos), os 3 hooks e a **ficha de decisões** (`RENDERS/decisoes_vN.md`,
formato em `04-plano.md` item 6). Esperar "ok".

## 5. Regras de diagramação (obrigatórias)
1. **Rosto livre** — antes do plano, `node scripts/folha-rosto.mjs --projeto <p>`; preencher `rosto[]` no projeto.json
   (`{ de, ate, y0, y1 }` por plano/enquadramento). O motor reposiciona a legenda (abaixo do queixo → acima da cabeça → reduz).
2. **Cada motion na palavra dele** — `de` = palavra da PRIMEIRA animação; nunca abrir painel antes da fala chegar nele.
3. **Leitura** — bloco inteiro ≥ 0,45 s na tela antes de qualquer transição; cenas `meia`/`cheia` ficam +0,5 s após a última palavra.
4. **Cortes permitidos** — pausas ≥ `corte.silencioMin` (0,5 s) saem; enquadramentos feios (orador virando de lado) ficam sob
   uma cena `cheia` com `entrada: "corte"`.
5. **Respiro** — chips/objetos fora da faixa do texto; legenda nunca sobre UI/objeto.
