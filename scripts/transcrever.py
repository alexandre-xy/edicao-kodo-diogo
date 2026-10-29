#!/usr/bin/env python
# Transcrição rápida na placa de vídeo (faster-whisper, CUDA). Substitui o Whisper na CPU e o
# "transcrever no DaVinci". Teste 28/10/2026 (RTX 4060, bruto de 9m39s): turbo 38 s · large-v3 4 min · CPU ~12 min.
#
#   python transcrever.py <video_ou_audio> [mais arquivos] [--modelo turbo|large-v3] [--saida <pasta>]
#                         [--json-whisper <arquivo.json>]
#
# Saídas ao lado do arquivo (ou em --saida), com o mesmo nome:
#   <nome>.srt         legenda em blocos curtos (≤ 32 caracteres, quebra em pausa/pontuação), pronta para o DaVinci
#   <nome>.txt         texto corrido
#   <nome>.words.json  [{ text, start, end, prob }] palavra a palavra
# --json-whisper grava também a lista de palavras no formato do `hyperframes transcribe` ([{ text, start, end }]),
# para entrar na Etapa 2 no lugar de whisper_large-v3.json (o align-words.mjs continua igual).
import argparse, json, os, site, subprocess, sys, tempfile, time

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
from pathlib import Path

# DLLs do CUDA (cuBLAS/cuDNN) instaladas via pip ficam em site-packages/nvidia/*/bin: pôr no PATH antes do import
for sp in site.getsitepackages() + [site.getusersitepackages()]:
    nv = Path(sp) / "nvidia"
    if nv.is_dir():
        for b in nv.glob("*/bin"):
            os.environ["PATH"] = str(b) + os.pathsep + os.environ["PATH"]
            if hasattr(os, "add_dll_directory"):
                os.add_dll_directory(str(b))

from faster_whisper import WhisperModel  # noqa: E402

MODELOS = {"turbo": "large-v3-turbo", "large-v3": "large-v3"}
MAX_CHARS, PAUSA = 32, 0.5


def wav16k(src: Path, tmp: Path) -> Path:
    out = tmp / (src.stem + "_16k.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(out)], check=True)
    return out


def ts(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def blocos(words):
    out, cur = [], []
    for i, w in enumerate(words):
        if cur:
            texto = " ".join(x["text"] for x in cur + [w])
            pausa = w["start"] - cur[-1]["end"]
            if len(texto) > MAX_CHARS or pausa >= PAUSA or cur[-1]["text"][-1:] in ".?!":
                out.append(cur)
                cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("arquivos", nargs="+")
    ap.add_argument("--modelo", default="turbo", choices=list(MODELOS))
    ap.add_argument("--saida")
    ap.add_argument("--json-whisper")
    ap.add_argument("--idioma", default="pt")
    a = ap.parse_args()

    t0 = time.time()
    model = WhisperModel(MODELOS[a.modelo], device="cuda", compute_type="float16")
    print(f"modelo {MODELOS[a.modelo]} carregado em {time.time() - t0:.1f} s", flush=True)

    for f in a.arquivos:
        src = Path(f).resolve()
        dest = Path(a.saida).resolve() if a.saida else src.parent
        dest.mkdir(parents=True, exist_ok=True)
        t1 = time.time()
        with tempfile.TemporaryDirectory() as tmp:
            audio = wav16k(src, Path(tmp))
            segs, info = model.transcribe(str(audio), language=a.idioma, word_timestamps=True, vad_filter=True, beam_size=5)
            words, textos = [], []
            for s in segs:
                textos.append(s.text.strip())
                for w in s.words or []:
                    t = w.word.strip()
                    if t:
                        words.append({"text": t, "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})
        if not words:
            print(f"{src.name}: nenhuma fala detectada (nada gravado)", flush=True)
            continue
        base = dest / src.stem
        (base.parent / (base.name + ".words.json")).write_text(json.dumps(words, ensure_ascii=False, indent=0), encoding="utf-8")
        (base.parent / (base.name + ".txt")).write_text("\n".join(textos) + "\n", encoding="utf-8")
        srt = []
        for n, b in enumerate(blocos(words), 1):
            srt.append(f"{n}\n{ts(b[0]['start'])} --> {ts(b[-1]['end'])}\n{' '.join(x['text'] for x in b)}\n")
        (base.parent / (base.name + ".srt")).write_text("\n".join(srt), encoding="utf-8")
        if a.json_whisper:
            Path(a.json_whisper).write_text(json.dumps([{k: w[k] for k in ("text", "start", "end")} for w in words], ensure_ascii=False), encoding="utf-8")
        print(f"{src.name}: {info.duration:.0f} s de áudio em {time.time() - t1:.1f} s -> {base}.srt", flush=True)


if __name__ == "__main__":
    sys.exit(main())
