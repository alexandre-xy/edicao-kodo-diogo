# Partes aproveitadas da taste-skill

Origem: https://github.com/Leonxlnx/taste-skill (commit f624f37, 14/10/2026), licença MIT (cópia em `LICENSE-taste-skill.txt`, precisa acompanhar os arquivos). Nada foi instalado; são só cópias para consulta e uso pontual.

## motion.md (referência de animação)

Foi escrito para sites, então nem tudo serve para vídeo.

**Serve para o HyperFrames/GSAP:**
- §2 "Quatro perguntas": para que serve cada animação, qual easing, quanto dura.
- §3 Tokens de easing e as durações. A regra "sair é mais rápido que entrar (~70%)" vale direto para entradas e saídas de grafismos e splits.
- §5 "Signature moves": um único momento forte por vídeo, o resto discreto.
- §7 "O que entrega motion gerado por IA": mesmo fade+slide em tudo, bounce/elastic, tudo com o mesmo tempo.

**Ignorar:** §4 receitas (scroll, hover, menu, acordeão) e §6 (prefers-reduced-motion), que só existem em página web. A regra de "mínimo 8 elementos se movendo" também é de site e não vale para os nossos vídeos.

**Equivalentes no GSAP (aproximados):**

| Token CSS | GSAP | Uso |
|---|---|---|
| `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` | `quint.out` | entradas de texto e cartões |
| `--ease-in-out: cubic-bezier(0.76, 0, 0.24, 1)` | `quart.inOut` | push-in, split abrindo/fechando, coisas que viajam na tela |
| curva exata | `CustomEase.create("kodoOut", "0.22,1,0.36,1")` | quando precisar do valor idêntico |

Continua valendo a regra nossa: push-in suave (1,0 a 1,05), sem snap.

## assets.mjs (busca de imagem e vídeo de arquivo com crédito)

Script Node sem dependências (Node 18+), sem chave de API. Busca em Openverse, Wikimedia Commons, Art Institute of Chicago, Met Museum, Internet Archive (Prelinger) e NASA, baixa e grava os créditos. Rodar no PC, numa pasta de trabalho do vídeo:

```
node assets.mjs "sao paulo 1950" --video --license pd --orientation portrait
node assets.mjs "pharmacy vintage" --license pd --limit 8
node assets.mjs --get <ref> --to assets
node assets.mjs --credits --to assets
```

- Buscas funcionam melhor em inglês.
- **Para vídeo de cliente use `--license pd`** (domínio público e CC0). O padrão `safe` inclui CC BY e CC BY-SA, que exigem crédito visível, e o BY-SA pode obrigar a licenciar a peça inteira do mesmo jeito. Não serve para anúncio.
- Os créditos ficam num arquivo JSON dentro da pasta indicada em `--to`; guardar junto com o projeto do vídeo.
- Não confere direitos de imagem de pessoas ou marcas que aparecem no material; isso continua sendo checagem nossa.
