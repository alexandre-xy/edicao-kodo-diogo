#!/usr/bin/env python
# Locução por IA com Chatterbox multilíngue (pt-BR) na placa de vídeo, com ou sem voz de referência (clonagem).
# Testado 28/10/2026 (RTX 4060): ~1x tempo real depois do aquecimento, ~3,9 GB de VRAM.
#
#   python locucao.py --texto falas.txt --saida <pasta> [--referencia voz.wav] [--exaggeration 0.5] [--cfg 0.5]
#
# falas.txt: uma fala por linha. Saída: <pasta>/fala_01.wav, fala_02.wav… + falas.json (texto, duração).
# REGRA: só clonar voz com autorização ESCRITA da pessoa, e só para o uso combinado.
# Referência boa = 10–30 s de lapela/estúdio, sem eco, sem música, tom normal dos vídeos. Trecho de bruto
# com som de sala deixa o timbre estranho (em teste não convenceu por isso).
import argparse, json, time
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--texto", required=True)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--referencia")
    ap.add_argument("--exaggeration", type=float, default=0.5)
    ap.add_argument("--cfg", type=float, default=0.5)
    ap.add_argument("--idioma", default="pt")
    a = ap.parse_args()

    falas = [l.strip() for l in Path(a.texto).read_text(encoding="utf-8").splitlines() if l.strip()]
    out = Path(a.saida)
    out.mkdir(parents=True, exist_ok=True)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    t0 = time.time()
    model = ChatterboxMultilingualTTS.from_pretrained(device=dev)
    print(f"modelo carregado em {time.time() - t0:.1f} s ({dev})", flush=True)

    res = []
    for i, t in enumerate(falas, 1):
        t1 = time.time()
        kw = {"language_id": a.idioma, "exaggeration": a.exaggeration, "cfg_weight": a.cfg}
        if a.referencia:
            kw["audio_prompt_path"] = a.referencia
        wav = model.generate(t, **kw)
        f = out / f"fala_{i:02d}.wav"
        ta.save(str(f), wav, model.sr)
        dur = wav.shape[-1] / model.sr
        res.append({"arquivo": f.name, "texto": t, "duracao": round(dur, 2)})
        print(f"{f.name}: {dur:.1f} s de áudio em {time.time() - t1:.1f} s", flush=True)
    (out / "falas.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
