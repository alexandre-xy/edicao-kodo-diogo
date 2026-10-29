# Etapa 5c · Sound design (motor viral) — doutrina do MD do tutorial, independente da biblioteca

O motor já posiciona SFX por categoria (`addSfx(cat, t, db)` → arquivo = `style.json → sfx.mapa[cat]`). Para usar a biblioteca
do piloto: **mapear cada categoria a um arquivo** em `templates/<t>/sfx/` (ou ASSETS/sfx) e ajustar `sfx.mapa`.

## Famílias → níveis (mixer)
| Família | Categorias do motor | Nível | Quando |
|---|---|---|---|
| Whooshes (movimento) | `whoosh` | **−10 a −12 dB** | todo deslizamento: painel, íris, wipe, câmera, cartões entrando |
| Texturas (sem deslizar) | `pop`, `click`, `ui`, `impacto`, `sucesso`, `erro` | **−6 a −7 dB** | pops, cliques, revelações, UI mudando, objeto entrando |
| Risers/Hits (antecipação) | `riser`, `hit` | **−5 dB** | ~5 s após o hook, mudanças de segmento/capítulo; **hit por baixo do riser** |
| Música | — | **−19 dB, só sob o orador** | nunca sob animações/gráficos |

Regras: o **pico do whoosh no quadro mais rápido** do movimento; textura **no quadro do evento**; riser **termina no quadro da
transição**; antecipar cortes 2–3 quadros; uma batida mais forte por cena; voz nunca coberta; ≥ 2 risers "sharp bass" e 2
metálicos por vídeo; nunca whoosh em algo que pipoca, nem pop em algo que desliza; um SFX por evento.

## Mapa do motor (o que a skill já faz)
íris/painel/wipe → `whoosh` (−1 a −2 dB sobre a família) · capítulo entra/ativa → `ui`/`click` · snap do ícone → `impacto`+`click` ·
segmentos → `click` por segmento · objeto central → `impacto` + `whoosh` · cartões de apoio → `whoosh` (−2 dB) · chips → `pop` ·
slider → `whoosh`+`ui`.

## Passadas (revisão do som)
1) whooshes (todos os movimentos) → 2) texturas (todos os eventos) → 3) risers/hits → 4) música (só após aprovar 1–3).
Relatar por passada. Medir loudness do render: voz ≈ −14 LUFS; pico ≤ −1,5 dBTP; se o empilhamento mais alto clipar, **baixar o hit, nunca a voz**.

## Pendências desta versão
- **Risers/hits**: a biblioteca-base do template não tem risers; mapear `riser`/`hit` (ex.: `hit` = impacto grave) e escolher onde (hook+5 s, viradas).
- **Música sob o orador só**: ainda não automatizada no motor viral (trilha curta com cortes nas cenas de animação); fazer no DaVinci ou
  adicionar `trilha` com envelope (a implementar).
