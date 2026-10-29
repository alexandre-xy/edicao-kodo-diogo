# Princípios de trabalho na edição (18/10/2026)

Adaptação das 4 regras do pacote "karpathy-guidelines" (pensar antes, simplicidade, mudanças cirúrgicas, meta verificável) ao fluxo de vídeo da Kodo.

1. **Pensar antes de construir.** Referência nova: primeiro análise (quadros, tempos, o que dá para replicar e o que realmente fica bom). Só constrói depois do ok. Diz as suposições (trecho da fala, referência usada, posição no quadro) e só pergunta quando a dúvida muda o resultado.
2. **Simplicidade.** O mínimo de motion que serve à fala. Nada que ele não pediu; cada grafismo justifica o espaço. Nenhuma palavra repetida entre legenda e motion.
3. **Mudanças cirúrgicas.** Ao corrigir, mexe só no que ele apontou pelo número do quadro; o resto fica idêntico à versão anterior. Avisa o que mudou.
4. **Meta verificável.** Cada pedido vira critério conferível na prévia (palavra na hora da fala, texto longe da borda, grafismo termina no corte). Prévia numerada (~48 quadros) antes de renderizar, nota 0 a 10 (abaixo de 8 refaz), checagem de entrega (qa.mjs) no fim.

Nos scripts Node da skill: não reescrever o que já funciona (sincronismo de palavras, recorte RVM).
