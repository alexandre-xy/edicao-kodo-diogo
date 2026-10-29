# Catálogo de grafismos (receitas)

Receita = item do catálogo HyperFrames (arquivo fixado em `vendor/`) + adaptador em `receitas.mjs` que aplica as
cores/fonte do template e liga ao tempo das palavras. **O visual vem do template; o projeto só escolhe a receita e
preenche os dados.** Ver o movimento antes de aprovar: `https://hyperframes.heygen.com/catalog/<components|blocks>/<origem>`.

## Favoritas (testadas em 1080×1920, painel split 1080×806, template editorial-pictograma)
| Receita | Faz | `dados` | Origem |
|---|---|---|---|
| `troca-riscada` | uma palavra é riscada e vira outra | `de`, `para`, `riscaEm`, `revelaEm` (palavras), `tamanho` | strikethrough-replace |
| `pilha-de-contas` | cartões entram empilhados, cada um na palavra falada | `itens:[{titulo, corpo, em}]`, `passo`, `largura` | visual do notification-stack, **código próprio** (o do catálogo comprime as entradas em ~4 s) |
| `contador` | número conta até o valor | `valor`, `sufixo`, `prefixo`, `escala` (+ `em`, `caixa` no item) | count-up |
| `check` | check de conclusão + rótulo | `rotulo`, `escala` (+ `em`) | success-check |

## Para o vertical (aprendido)
- As receitas do catálogo são elásticas (dimensionam pela caixa, em `cqmin`) e nascem pequenas para 9:16: o adaptador
  escala (`escala`); número: ~2,1–2,6 em caixa de 390 px, 1,6 em painel inteiro.
- Cores: as receitas leem `--fg --accent --accent-2 --brand --surface --border --font-*` do elemento hospedeiro; o
  adaptador injeta os do template. `accent:"green"` mapeia para `--brand`.
- Receitas **com duração própria** (count-up 3 s, notification-stack 4 s): o adaptador ajusta `data-duration` do arquivo
  copiado para a duração do painel; se o componente ainda ignorar tempos longos, escrever versão própria (como `pilha-de-contas`).
- Texto longo no contador (ex.: "24 meses") encosta na borda: reduzir `escala`.
- Rótulos vêm em inglês em algumas receitas (radial `overwhelm-surround`: "Now", "Inbox"…): **não usar** sem traduzir o arquivo.
- Evitar: shaders WebGPU, carrosséis de imagem.

## Como adicionar uma receita
1. Buscar: `npx hyperframes@<pin> catalog --query "<movimento em inglês>"`; ver a página; instalar num projeto de teste
   (`init` + `add <id>`), ler as variáveis (`data-composition-variables`) e a seção "Timeline integration".
2. Copiar o arquivo para `vendor/<id>.html`; escrever o adaptador em `receitas.mjs` (html + js + sfx) seguindo as 4 existentes.
3. Testar em 1080×1920 dentro do painel (`snapshot`), conferir escala, cores, texto em português e duração.
4. Registrar aqui (linha na tabela) e em `APRENDIZADOS.md` se houver pegadinha.

## Candidatas ainda não testadas (do catálogo, por tema)
anel de progresso `conic-progress-ring`, `mk-usage-arc`, `mk-progress-stat` (bloco fixo 1920×1080); lista `mk-specs-list`,
`stagger-cascade`; destaque de frase `marker-highlight`, `mk-callout-highlight`; comparação `comparison-split`,
`before-after-wipe`; lower third `lt-*` (13 estilos); legendas `caption-*` (17 estilos); HUD `telemetry-hud`.
