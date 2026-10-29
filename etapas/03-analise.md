# Etapa 3 · Análise de conteúdo

Entrada: `hf/build/words.json` + **mapa de cortes** do vídeo: `ffmpeg -i <video> -vf "scdet=threshold=3" -f null -` (lista
`lavfi.scd.time`). Mudança de zoom/enquadramento conta como corte. Todo grafismo começa e termina dentro de uma cena. Saída (tudo vai na mensagem única da Etapa 4, sem parada extra):

- **Corte + Finalização**: trechos por índice de palavra (`{ id, from, to, in?, out?, tail? }`), cortando tropeços,
  repetições e enchimentos; pausas ≥ `silencioMin` viram jump cut automático.
- **Apenas Finalização**: não recortar. Os cortes vêm do XML (`finalizacao.mjs`).
- **Mapa de raciocínios**: blocos de ideia, viradas, clímax.
- **Hook com o personagem principal em tela** (pode ter motion por trás/ao redor dele, nunca full motion no lugar dele).
- **Full motion** (tela cheia, sem o orador): só no meio, em fala descritiva que pede ilustração, entre dois cortes.
- **Hooks (3 candidatos)** (só no modo com corte; na Finalização o hook já está no corte do piloto). Cada um avaliado
  **sem som**: os 2 primeiros segundos precisam prender só com imagem + texto (personagem em tela, algo se mexendo, frase legível).
  Na mensagem do Portão 2, mostrar os 3 lado a lado (quadros de 0–2 s) e dizer qual eu escolheria e por quê.
- **Zoom/enquadramento muda a cada corte** (jump cut): alternar plano aberto ↔ fechado (ex.: 100% → 115–125%) usando o
  espaço acima da cabeça; nunca dois cortes seguidos com o mesmo enquadramento. Espaço vazio acima da cabeça por muitos
  segundos = lugar para plano fechado ou para grafismo/informação. Se o bruto vier sem folga acima da cabeça, avisar no
  Portão 2 e registrar no `APRENDIZADOS.md` do cliente (orientar a próxima captação: deixar folga acima da cabeça).
- **Momentos de grafismo** — o ponto que mais rende. Procure na fala: **número/valor/taxa/prazo** (contador),
  **lista de itens** (pilha de contas, checklist), **comparação/troca** ("X vira Y": troca riscada),
  **conclusão/solução** (check), **metáfora visual** (pessoa sufocada, escada). Para cada momento: palavra de entrada
  e de saída (índices), formato (**split** por padrão) e **2–3 receitas candidatas**.
- **Receitas**: 1º `grafismos/CATALOGO.md` (favoritas já testadas em vertical). Se nada servir, buscar no catálogo
  HyperFrames **em inglês**: `npx hyperframes@<pin> catalog --query "<o movimento>" 2>&1 | grep -E "^\S+\s+(block|component)" | head`.
  Mostrar ao piloto o link `https://hyperframes.heygen.com/catalog/<components|blocks>/<id>` para ele VER antes.
- Rosto/posição: âncora do zoom (`corte.ancora`) e áreas a disfarçar (`disfarce`). Se o rosto fica cortado quando o
  painel sobe, reduzir `splitSubida` (padrão do template −120; plano fechado pede −40).
