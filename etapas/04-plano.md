# Etapa 4 · Plano + folha de prévia — PORTÃO 2

1. Preencher `projeto.json`: corte/legenda/hook/cartão e **`grafismos[]`** (formato abaixo). Sem `cenas.mjs` à mão.
2. `prepare-assets.mjs` → `build-comp.mjs` → `hyperframes check` → `snapshot --at <momentos>`.
3. **Folha de prévia numerada** (**48 quadros**, com número, tempo e rótulo; o piloto corrige pelo número) em `RENDERS/previa_visual_vN.jpg`: montar com ffmpeg
   `xstack` a partir dos quadros do snapshot. Não precisa de render de vídeo.
4. **Autoavaliação** antes de mostrar: nota 0–10 (motion e estética, palavra na hora da fala, posição no quadro, rosto
   livre, nada atravessando corte, legenda sem repetir motion, instruções seguidas). **< 8 → refazer**; ≥ 8 → apresentar
   com a nota e o que tirou ponto.
5. **Mensagem única** ao piloto: plano (duração, grafismos com a receita de cada um, trilha/SFX, cartão), folha, os
   3 hooks e TODAS as perguntas (texto do cartão, palavras duvidosas da legenda, ajustes de enquadramento). Esperar "ok".
6. **Ficha de decisões** junto (`RENDERS/decisoes_vN.md`, curta): (a) o que eu escolhi **sem perguntar** e por quê
   (receita, cor, ritmo, zoom, trilha, o que cortei); (b) **lista de cortes** com tempo do bruto → tempo da versão e o
   motivo (pausa, tropeço, repetição); (c) duração antes → depois. O piloto lê em 1 minuto e aponta o que discorda.

## Formato de `grafismos[]` (índices de palavra do words.json)
```json
"grafismos": [
  { "de": 3, "ate": 8, "itens": [ { "receita": "troca-riscada", "dados": { "de": "barato", "para": "caro", "riscaEm": 4, "revelaEm": 5 } } ] },
  { "de": 70, "ate": 95, "itens": [ { "receita": "pilha-de-contas", "dados": { "itens": [ { "titulo": "Pró-soluto", "corpo": "cento e poucas vezes", "em": 73 } ] } } ] },
  { "de": 138, "ate": 145, "depois": 1.0, "itens": [
      { "receita": "contador", "em": 139, "caixa": [10, 390], "dados": { "valor": 5, "sufixo": "%", "escala": 2.6 } },
      { "receita": "contador", "em": 142, "caixa": [400, 390], "dados": { "valor": 24, "sufixo": " meses", "escala": 2.1 } } ] },
  { "de": 157, "ate": 173, "depois": 0.15, "itens": [ { "receita": "check", "em": 160, "dados": { "rotulo": "sem pró-soluto" } } ] }
]
```
Cada entrada abre um painel (split) de `W(de)−0,15 s` até `WE(ate)+depois` (padrão 0,1). `caixa: [top, altura]` divide o
painel. Cores/fonte vêm do template. Receitas e campos: `grafismos/CATALOGO.md`.
Outros campos do projeto: `splitSubida` (px que o vídeo sobe quando o painel abre), `cartao.inicio` (segundo em que o
cartão final entra; use quando o bruto termina com preto reservado), `cartao.tamanho1/tamanho2`, `trilha: { mixada: true }`.
