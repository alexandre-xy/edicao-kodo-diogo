# Aprendizados (ler na Etapa 1; acrescentar na Etapa 8)

## Direção (1º piloto, v1→v4)
- Movimentos com ease in/out forte (0,6–1 s); nada de "snap". Saltos de enquadramento entre cortes incomodam:
  usar só 2 enquadramentos próximos (1,0 ↔ 1,05) e transição overlay nas viradas de raciocínio.
- Mais SFX acompanhando cada animação (+3 dB sobre o "certo no papel"); whoosh suave em toda entrada/saída de split.
- Círculos/anéis com folga em volta do boneco (centro = centro do boneco). Boneco com pés exatamente no degrau
  (grupo SVG com escala: deslocamento local = deslocamento ÷ escala), terminando no objetivo (bandeira).
- Grafismo entra quando a fala chega no assunto ("começa a se aprimorar" → escada).
- Repetir o áudio do hook no meio soa erro de montagem → payoff visual.
- Som próprio de overlays do cliente deve tocar, nivelado (vinham de −15,8 a −31 LUFS → ~−17).
- Legenda fiel à fala (o cliente reverteu "melhorias" de texto). Corrigir só grafia.
- **Respiro do texto**: palavra nunca encosta em linha, anel ou raio de grafismo — folga visível (≥30 px). Conferir na folha.
- Logo do cliente sem vetor: não redesenhar/vetorizar de print (ficou ruim, rejeitado). Grafismo neutro ou pedir o vetor.
- Trilha tem que **começar forte no hook** (entrar já no drop/trecho cheio), não na intro calma. Virada marcada por flash + hit.
- Nada de zumbido/cama sintética de "ambiente": ambiência = SFX nas animações.
- ffmpeg 9: `adelay`/`apad` no mesmo grafo depois do `acrossfade` são ignorados → fazer em 2 passos.
- Remover enchimentos ("ah, né", "né?") e pausas > 0,3 s: 77 s de bruto → 63 s.

## Técnica
- Whisper erra tempos por palavra em até 0,6 s → Parakeet para tempos + travar nos silêncios (align-words).
- Câmera "fixa" de depoimento pode derivar ~300 px no 4K → disfarce de logo com rastreio por plano.
- Parede branca: legenda amarela fica ilegível → faixa escura suave atrás da zona da legenda (contraste ≥ 3:1).
- Último bloco de legenda sem fim (NaN) cobre o cartão final → limitar ao início do cartão.
- GSAP: estados iniciais com `gsap.set`; `fromTo` repetidos com `immediateRender:false`; destino precisa revelar.
- Carve só depois de gerar o index.html (regenerar apaga o carve).
- **Mídia do HyperFrames tem que estar dentro do projeto (`DATA/hf/assets`)** — `../../FOOTAGE` não carrega (snapshot preto).
- Windows: `npx` via `execFileSync` precisa de `shell: true`. `HYPERFRAMES_WHISPER_PATH` pode ser passado por env no comando.
- Caminhos com acento/espaço (ex.: `D:\2 - VÍDEO\…`): ffmpeg, HyperFrames e FCPXML (`encodeURIComponent` por segmento) ok — testado.
- ffmpeg overlay de camadas ProRes para conferência: `setpts=0` nas duas entradas.

## DaVinci Resolve 21 (FCPXML 1.9)
- Import validado: V1 com transform/keyframes, camadas alpha, legendas, áudio e keyframes de volume chegam certos.
- **Mídia com timecode embutido ≠ 0 fica offline e não reconecta** (o clipe declara start 0s). Regra: toda mídia do
  pacote copiada para `media/` com nome ASCII e **sem timecode** (`-map_metadata -1 -write_tmcd 0`).
- O que o XML não leva: ajuste de cor (P&B), EQ do carve (só o volume), tremida de câmera. Documentar no LEIA-ME.
- Trocar um grafismo depois: mesmo nome e duração → Relink / Delete Render Cache.

## Grafismos por receita e modo Finalização (out/2026)
- **Entrada da Finalização é a timeline (.fcpxml + mixdown), não um mp4 cortado**: com mp4 único o V1 volta como 1 clipe
  e os cortes do editor se perdem. Vários vídeos na mesma timeline → 1 bloco por vídeo (`finalizacao.mjs`).
- Bruto pode terminar com **preto reservado ao cartão final** (blackdetect): usar `cartao.inicio` logo após a última fala.
- Painel split sobe o vídeo `splitSubida` px: em plano fechado cortou o topo da cabeça → −40 em vez de −120.
- Grafismos funcionaram melhor como **receitas do catálogo + cores do template**: 4 grafismos em ~1 KB de JSON.
  Componentes elásticos do catálogo ignoram tempos longos (notification-stack comprimiu 9 s em ~3 s): código próprio.
- Contador "24 meses" precisa de painel que fique ~1 s depois da fala (`depois`), senão a contagem é cortada.
- Legenda: `substituir` por índice corrige grafia e troca de palavra ("no impacto"→"não impacta"; "ponta"→"conta");
  `null` remove palavra. O motor força minúsculas na legenda.
- hyperframes imprime spinner: redirecionar para log. Duas transcrições seguidas sobrescrevem `transcript.json`.
- Áudio com trilha mixada: loudnorm do mixdown (−14,2 LUFS, pico −1,5) vai como `audio_nivelado` com ganho 0 no Resolve;
  o render do HyperFrames mede ~1 dB abaixo do loudnorm.
- `check` acusa `multiple_root_compositions` por causa dos `layer-*.html` (esperado).

## 1º teste real: XML do Resolve → pacote → Resolve (CLAUDE TEST 2, out/2026)
- **Funcionou**: o export FCPXML 1.9 do Resolve (clips `asset-clip`/`clip`+`video`, `gap`, `tcStart` ≠ 0, mídias `file://localhost/…`)
  é lido por `finalizacao.mjs ler`; o pacote reimportou com os 10 cortes e a rotação do clipe 7.
- **Bug do áudio repetido**: `audio_nivelado` é alinhado ao tempo da TIMELINE (0 = início do bloco). Posicionar cada pedaço pelo
  tempo da MÍDIA ORIGINAL (`srcStart`) repete/embaralha o áudio. Com trilha mixada (`!HAS_MUSIC`) agora vai UM clipe contínuo `start=0`.
  Regra: nunca misture tempo de mídia original com tempo de timeline ao colocar o áudio nivelado.
- Preview (`mixdown`) e mídias originais têm tempos diferentes: a prévia usa a mixdown; o pacote usa os originais.
- Logo do cliente pequena (92×40) funcionou ampliada 4× com lanczos dentro do hub; sem vetorizar.
- Paleta do cliente = novo template (cópia do `editorial-pictograma` com outras cores): `painelTexto`, `superficie`, `tons`, `cartao` no style.json.

## Motor viral (v2, out/2026) — 1º teste (réplica de um estilo de referência)
- Estilo medido quadro a quadro do vídeo-referência: entradas rápidas (0,15–0,27 s), câmera 0,45 s, snaps pontuais.
  Conflito com a v1 ("sem snap"): resolvido por parâmetro `ritmo: viral | suave` no template.
- **Legenda**: palavra-chave em serif itálico com **máscara L→R de borda suave** (~1 letra/quadro) via CSS var `--p` animada; palavras sans com fade+blur 0,2 s.
  Tela cheia usa texto ~1,2× (sans ≈ 50 px; serif 2,2× o sans) em bloco de ~940 px; chips/objetos fora da faixa do texto (respiro).
- Meia tela: orador em recorte fechado (escala 1,4, deslocado ~880 px) e painel claro de 960 px descendo do topo (0,24 s ease-out).
- Whisper: legenda em minúsculas → `capitalizar` (início de frase). Palavras repetidas/alucinadas do ASR (mesmo tempo): zerar com `legenda.substituir: {i: null}`.
- Motor registra animações com `anim(sel, from, to, t)`: `from` mais cedo vira `gsap.set` inicial; evitar tweens sobrepostos (o `check` avisa) e `transform` CSS em elementos animados (o `check` bloqueia).
- Render do HyperFrames: ~2 min por 1 min de vídeo (standard); `draft` ~1,5 min. Conferir por `snapshot --at ... --no-end` (1 folha).
- Pendências: músicas só sob o orador (envelope), risers/hits na biblioteca, pacote DaVinci (.fcpxml) e camadas alpha do motor viral, medir punch-ins do exemplo.

## Motor viral — 1º vídeo real (XML + mixdown) — feedback da v1 → v2
- **Sincronia**: a cena abre na palavra da PRIMEIRA animação (não no início da frase) e cada elemento entra na palavra dele;
  o motor adianta toda animação ligada a palavra em 0,06 s (`avanco`) para parecer exata. Painel que abre e fica vazio = erro.
- **Legenda nunca em cima do motion**: em cena `ui` a legenda ancora pela BASE (cresce para cima, 56 px acima da UI);
  chips/objetos fora da faixa do texto; texto em cena cheia 0,9–1,2×.
- **Cortes permitidos no bruto**: no modo viral dá para usar o mixdown como fonte e `build-edit` (corte + pausas ≥ `silencioMin` 0,5 s;
  `zooms [1,1]` para não saltar enquadramento); a pausa de 0,74 s antes de "Se você quer…" saiu, e a cena cheia entra por `corte`.
- Meia tela → tela cheia: não animar a saída do painel (revelava o orador de lado/preto); a tela cheia cobre o painel (gap < 1 s).
- Fechamento: logo em "ícone de app" (quadrado arredondado) grande (≈ 360 px), entra na palavra da marca; degradê fica até o fim.
- Marca falada pelo ASR pode estar errada (nome da empresa transcrito errado, visível no crachá): conferir no quadro e perguntar no Portão 2.
- Imagem de apoio: preferir material do cliente; objeto-metáfora vetorial (escudo+cadeado) quando não há asset.

## Motor viral — regras criadas na rodada 2 (feedback do piloto)
- **Rosto nunca coberto (regra fixa)**: medir `rosto[]` (topo do cabelo → queixo, px 1080×1920, por enquadramento) com
  `scripts/folha-rosto.mjs` (folha de grade 1 quadro/s). O motor mede a altura REAL de cada bloco de legenda no Chrome
  (`build/medir.html`) e posiciona: livre → abaixo do queixo (peito) → acima da cabeça → reduz o texto. Se o bloco atravessa um corte
  de enquadramento, ele muda de posição junto com o corte. Meia tela: o recorte do orador é calculado para o topo do rosto cair
  em `zonaLegenda` (1200 px), deixando a faixa de cima do painel livre para a legenda.
- **Leitura**: todo bloco fica inteiro na tela ≥ 0,45 s antes de sair; se o próximo começaria antes, ele é atrasado até 0,5 s;
  nunca entra dentro de uma tela cheia já iniciada. A cena que contém o bloco é a do intervalo [de, ate] (não pelo tempo).
- **SFX de chegada**: slider (cursor chega ao destino) leva click + ui; todo "estado final" de um elemento merece som.
- Instantes de mostrar/esconder têm duração 0 (nenhum quadro cai no meio, evita "fantasma" de 1 quadro).
- Música: ganho calculado por ebur128 (alvo −26 LUFS) com envelope: cai nas cenas de animação (`sobAnimacaoDb`, padrão desliga).
- Armadilha: regex/`${}` em `node -e "…"` no bash perdem `\` e `$` → patches do motor via arquivo `.mjs` com heredoc entre aspas.

## Pacote DaVinci (motor viral) — feedback do 1º import no Resolve
- **Cada efeito = sua própria camada/trilha, um clipe por uso, nada mesclado.** O degradê veio como UM clipe longo (+ a faixa da legenda junto)
  e parecia "misturado" com outros motions. Agora: `faixa` (faixa da legenda) e `degrade` são camadas separadas, com um clipe por trecho
  de uso (nomeados "Degradê escuro (UI) N", "Faixa escura da legenda N"); cenas, UI e legendas também (um clipe por cena/bloco).
- Regra: nenhuma camada pode carregar pixels de outro elemento. Conferir com `alphaextract` + `signalstats` por região (medido: cenas/UI/legendas limpas).
- Camada longa e quase vazia atrapalha o editor (parece "tudo junto"): cortar sempre só onde o efeito existe.
- Ordem de faixas do pacote viral: V2 faixa · V3 degradê · V4/V5 cenas · V6 UI · V7 legendas; áudio A1 voz · A2 trilha (envelope) · A3+ SFX.
- Ainda a validar com o piloto: V1 em originais 4K (formato retrato 2160×3840 com rotação −90), keyframes do recorte na meia tela, envelope da trilha.

## Testes na nuvem (17–18/10/2026): vídeo de um lounge e promo da Kodo
Regras que viraram fixas estão no SKILL.md. Aqui fica o que é técnica/contexto.
- **Full motion "palavras em profundidade"**: profundidade 3D de HTML. Desfoque na camada 3D achata a profundidade por um
  instante (palavras "pulam") → desfocar cada palavra, não o container. Apagar as palavras de trás quando a última entra.
- Para cliente quente (lounge): fundo plano escuro + dourado, partículas e luzes desfocadas; nada de grade/HUD tecnológico.
- **Colagem foto + lettering** (aprovada a prévia v2/v4): foto principal em cartão girado já aparece em parte desde o 1º quadro,
  lettering acima; no fim da frase a câmera desce revelando foto e recortes; palavra-chave por cima da foto só depois de ~0,5 s
  de foto limpa e sem cobrir rostos. Reprovado: câmera andando sobre papel com a foto quase escondida.
- Recortes de produto entram com bounce leve e ficam com micromovimento contínuo ("vivos").
- Texto atrás do expert: centralizado, em 2 linhas, longe das bordas, com tempo de leitura (não atravessar rápido).
- Sem transcrição palavra a palavra: medir o início de cada palavra na onda do áudio (erro ~50 ms).
- **Locução gravada pelo piloto**: as pausas da gravação NÃO correspondem às frases do roteiro. Medir palavra a palavra
  (alinhamento por DTW contra uma voz sintética funcionou) antes de cortar cenas. Palavras ditas rápido (Branding/Conteúdo)
  podem ganhar respiro cortando/reespaçando a locução.
- Promo em partículas: fundo alternando claro/escuro (texto com blend difference) prende atenção; títulos sem numeração;
  legenda em 1 linha nesse estilo.
- Áudio feito na nuvem saiu baixo (−20 LUFS) → normalizar para −14 LUFS, pico −1,5 dBTP; `qa.mjs` confirmou.
- Os scripts de áudio da nuvem (gerar SFX, DTW, mix) eram Python: portar para Node quando entrarem na skill.

## Referência "Learn 90% of Claude Video Editing" (YouTube, 22/10/2026) — aplicado em 28/10/2026
- Adotado: ficha de decisões (Etapa 4/8), revisão só do trecho alterado antes × depois (Etapa 7), feedback em 4 partes
  com "Manter" (Etapa 7), 3 hooks avaliados sem som (Etapa 3), zoom a cada corte usando o espaço acima da cabeça (Etapa 3),
  área segura checada em todos os quadros (`scripts/zona-segura.mjs`, Etapas 6/8).
- Lição dele que já era nossa: quando a versão piora, voltar e escrever regra, não empilhar efeito.
- NÃO adotado (decisão nossa): grão, brilho, luz colorida e efeito de pele; correção de cor fica no DaVinci; Higgsfield.

## 28/10/2026 · Transcrição na GPU e locução por IA
- Bruto de 9m39s, RTX 4060: whisper.cpp na CPU ~12 min · faster-whisper large-v3 4 min · large-v3-turbo 38 s.
  Qualidade parecida; o turbo errou 1 palavra a mais ("sem" × "ser"). Legenda final = large-v3; .srt rápido = turbo.
  DaVinci aberto disputa a placa e deixa mais lento.
- Chatterbox (pt-BR) com referência tirada de bruto com som de sala: pronúncia limpa, timbre NÃO parecido ("ficou engraçado").
  Referência precisa ser lapela/estúdio, 10–30 s, sem eco. Clonagem só com autorização escrita.
- Avaliados e descartados: OpenCut (editor de clicar), anime.js (GSAP já cobre), blocos 3D prontos do HyperFrames
  (genéricos demais; 3D só sob medida). Na nuvem, 3D sem GPU leva ~6 s/quadro.
