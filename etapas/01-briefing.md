# Etapa 1 · Briefing — PORTÃO 1

O briefing vira o `DATA/projeto.json` (modelo: `modelos/projeto.modelo.json`). Padrões pré-preenchidos;
pergunte **numa mensagem só** apenas o que fugir do padrão. Nada pesado roda antes da aprovação.

1. Criar a pasta do cliente: `node scripts/novo-projeto.mjs "<raiz>" --nome <Nome> --template <t>`
   ```
   <Cliente>/ FOOTAGE/  ASSETS/{trilha,sfx,transicoes,logos,broll}/  REFS/  RENDERS/
              DAVINCI_PROJECT/{entrada,saida/vN}/  DATA/{projeto.json, cenas.mjs, transcricao/, cache/, hf/}
   ```
2. Campos obrigatórios (com padrão):
   - **Modo**: `corte+finalizacao` (brutos em FOOTAGE) | `finalizacao` (piloto já cortou). **Finalização exige a TIMELINE**:
     `.fcpxml` exportado do Resolve + render leve da mesma timeline (`mixdown.mp4`) em `DAVINCI_PROJECT/entrada/`.
     Se o piloto mandar só um mp4 já cortado: **pedir o XML** (sem ele os cortes não voltam ao DaVinci). Vários vídeos
     na mesma timeline, separados por espaço vazio, viram 1 bloco/projeto cada (`scripts/finalizacao.mjs ler`).
   - Segmento (Saúde/Estética Médica · Corporativo B2B · Anúncios/Lançamentos) e tipo (Depoimento · Pílula 1–1m30 · Ads 30 s).
   - **Saída travada**: formato (9:16 · 16:9 · 1:1), resolução, **fps** (fração exata, ex. 24000/1001), 48 kHz, loudness (−14 LUFS redes), pico −1,5 dBTP.
   - Duração-alvo · idioma · CTA · lower third · logo/marca (sim/não).
   - **Legenda**: literal (padrão) ou "ortograficamente correta"; palavras proibidas; **linhas** (`legenda.linhas`: 1 ou 2) e
     posição. Vem do template/cliente; só perguntar se o estilo for novo.
   - **Som ambiente** (`som.ambiente`: `nao` | `sim`): cama/trilha ambiente sintética. Padrão do template; só perguntar se o estilo for novo.
   - **Restrições**: rosto livre; logos de terceiros a disfarçar; **Saúde/Estética**: sem promessa de resultado,
     cuidado com antes/depois (publicidade médica).
   - **Estilo (pergunta obrigatória em toda edição)**: cliente com template → "seguir com o estilo atual (<template>) ou
     definir um estilo novo?". Cliente novo → sugerir 1–2 templates pelos metadados de `templates/*/style.json` ou
     "criar a partir de REFS" → Etapa 1.5. Template antigo do cliente nunca é apagado (vira histórico).
   - **Grafismos**: onde o piloto quer motion (números, listas, comparações) e formato (split / tela cheia). Padrão: split.
   - Trilha: já mixada no vídeo (`trilha.mixada`) ou arquivo em `ASSETS/trilha`.
   - Checklist de assets presentes (trilha + licença, SFX, transições, logos, fontes + licença).
   - Assets em dois níveis: **biblioteca geral** no SSD (`node scripts/biblioteca.mjs listar [trilha|sfx|transicoes|overlays]`)
     e **ASSETS do cliente** (o que é só dele: logos, b-roll, trilha comprada). O que vier da biblioteca é **copiado** para
     `ASSETS/` com `biblioteca.mjs copiar --projeto <p> sfx/risers/x.wav …`; o `projeto.json` só aponta para `ASSETS/…`.
     Ordem de escolha: ASSETS do cliente → biblioteca → sfx do template.
   - Quem aprova (piloto/cliente), máx. 2 rodadas, prazo, entregáveis (mp4 + preview + folha + pacote DaVinci).
3. Ler `APRENDIZADOS.md` antes de fechar o briefing.
   Referências novas do piloto (vídeos de inspiração): **primeiro análise curta** (folha de quadros, tempos, o que dá para
   replicar e o que fica bom) e esperar o ok; nada é construído antes.
4. **Portão 1**: mostrar o resumo de 1 página e esperar "ok".

Fora do escopo v1: vídeos sem fala (Bastidores/Cobertura por música) — avisar e parar.
