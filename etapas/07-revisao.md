# Etapa 7 · Revisão (máx. 2 rodadas)

Feedback do piloto em 4 partes (pedir neste formato; se vier solto, eu organizo assim e confirmo):
1. **Veredito**: aprovado · aprovado com ajustes · refazer.
2. **Corrigir**: `#quadro da folha (ou tempo DA VERSÃO) · problema · como deve ficar · obrigatório/opcional`.
3. **Manter**: o que está bom e NÃO pode mudar (vira trava: conferir na folha nova que continua igual).
4. **Me mostrar**: como quer ver a correção (padrão: só o trecho alterado, abaixo).
- Se o piloto citar tempo do bruto/plano, converter e dizer qual tempo foi usado.
- Legendas: frase exata entre aspas + regra geral (literal ou não) → aplicar no vídeo todo.
- Gosto (suavidade, volume): pedir uma medida ("suave ~1 s", "SFX metade da voz") ou referência.
- **Mudança cirúrgica**: alterar só o que o piloto apontou; o resto fica idêntico à versão anterior. Dizer o que mudou.
- **Mostrar só o que mudou**, antes do vídeo inteiro: folha **antes × depois** lado a lado só dos quadros do trecho
  alterado (`snapshot --at` nos mesmos tempos das duas versões + ffmpeg `hstack`). Se a correção for de movimento ou som,
  mini-vídeo só do trecho (±1 s) antes × depois: cortar o draft com `ffmpeg -ss/-to` e `hstack`. Render inteiro só
  depois do ok do trecho.
- **Quando der errado, adicionar regra, não efeito**: se a versão piorou, voltar ao que estava aprovado e escrever a
  regra que faltou (ex.: "uma coisa se move por vez", "pele natural"), em vez de empilhar grão/brilho/efeito para compensar.
- Folha da nova versão também com 48 quadros e nota (≥ 8).
- Cada correção → mudança em `projeto.json`/`cenas.mjs`/template, nunca no `index.html` gerado.
- Registrar mudanças por versão (o que mudou, desvios) no relatório da versão.
