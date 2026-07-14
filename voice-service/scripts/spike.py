"""Phase B de-risk spike: measure STT/TTS latency, validate browser codecs and Hindi VITS.

Run:  .venv/bin/python scripts/spike.py
Fixtures are expected in tests/fixtures/ (created by scripts/make_fixtures.sh).
"""
import json
import os
import time
from pathlib import Path

os.environ.setdefault("COQUI_TOS_AGREED", "0")

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures"
OUT = ROOT / "tests" / "out"
OUT.mkdir(parents=True, exist_ok=True)

results: dict = {}


def timed(label):
    def deco(fn):
        def wrap(*a, **kw):
            t0 = time.perf_counter()
            r = fn(*a, **kw)
            results[label] = round(time.perf_counter() - t0, 2)
            return r
        return wrap
    return deco


# ---------------------------------------------------------------- fixtures: webm/opus via PyAV
def make_webm(src_wav: Path, dst_webm: Path):
    import av

    with av.open(str(src_wav)) as inp, av.open(str(dst_webm), "w") as out:
        stream = out.add_stream("libopus", rate=48000)
        resampler = av.AudioResampler(format="s16", layout="mono", rate=48000)
        for frame in inp.decode(audio=0):
            for rf in resampler.resample(frame):
                for packet in stream.encode(rf):
                    out.mux(packet)
        for packet in stream.encode(None):
            out.mux(packet)


# ---------------------------------------------------------------- STT
def run_stt():
    from faster_whisper import WhisperModel

    t0 = time.perf_counter()
    model = WhisperModel("small", device="cpu", compute_type="int8")
    results["stt_model_load_s"] = round(time.perf_counter() - t0, 2)

    for name in ["fixture.wav", "fixture.m4a", "fixture.webm"]:
        p = FIX / name
        if not p.exists():
            results[f"stt_{p.suffix[1:]}"] = "MISSING FIXTURE"
            continue
        t0 = time.perf_counter()
        segments, info = model.transcribe(str(p))
        text = " ".join(s.text.strip() for s in segments)
        results[f"stt_{p.suffix[1:]}"] = {
            "seconds": round(time.perf_counter() - t0, 2),
            "language": info.language,
            "prob": round(info.language_probability, 2),
            "text": text[:120],
        }


# ---------------------------------------------------------------- TTS
EN_TEXT = (
    "Thanks for reaching out. To reset your password, open the sign-in page, "
    "choose Forgot password, and follow the email link we send you. The link "
    "expires after thirty minutes for security."
)  # ~200 chars
HI_TEXT = "नमस्ते! आपका पासवर्ड रीसेट करने के लिए साइन-इन पेज पर जाएँ और 'पासवर्ड भूल गए' चुनें।"


def run_tts():
    from TTS.api import TTS as CoquiTTS

    # English VITS (VCTK multi-speaker) — proposed default
    t0 = time.perf_counter()
    en = CoquiTTS(model_name="tts_models/en/vctk/vits", progress_bar=False)
    results["tts_en_load_s"] = round(time.perf_counter() - t0, 2)
    t0 = time.perf_counter()
    en.tts_to_file(text=EN_TEXT, speaker="p225", file_path=str(OUT / "spike_en.wav"))
    results["tts_en_200chars_s"] = round(time.perf_counter() - t0, 2)

    # Hindi via fairseq VITS bridge — quality gate
    try:
        t0 = time.perf_counter()
        hi = CoquiTTS(model_name="tts_models/hin/fairseq/vits", progress_bar=False)
        results["tts_hi_load_s"] = round(time.perf_counter() - t0, 2)
        t0 = time.perf_counter()
        hi.tts_to_file(text=HI_TEXT, file_path=str(OUT / "spike_hi.wav"))
        results["tts_hi_s"] = round(time.perf_counter() - t0, 2)
        results["tts_hi_status"] = "synthesized — listen to tests/out/spike_hi.wav"
    except Exception as e:  # noqa: BLE001
        results["tts_hi_status"] = f"FAILED: {type(e).__name__}: {e}"


if __name__ == "__main__":
    wav = FIX / "fixture.wav"
    webm = FIX / "fixture.webm"
    if wav.exists() and not webm.exists():
        try:
            make_webm(wav, webm)
            results["webm_fixture"] = "created via PyAV libopus"
        except Exception as e:  # noqa: BLE001
            results["webm_fixture"] = f"FAILED: {e}"

    run_stt()
    run_tts()
    print(json.dumps(results, indent=2, ensure_ascii=False))
    (OUT / "spike-results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False))
