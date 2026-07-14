"""Pre-download and load all configured models so the first user request
isn't a multi-hundred-MB surprise. Run: .venv/bin/python scripts/warm.py"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import stt  # noqa: E402
from app.config import parse_vits_models, settings  # noqa: E402
from app.tts import registry  # noqa: E402

print(f"Warming Whisper '{settings.whisper_model}' ...")
t0 = time.perf_counter()
stt.get_model()
print(f"  ready in {time.perf_counter() - t0:.1f}s")

PROBE = {
    "en": "Hello, how can I help you today?",
    "hi": "नमस्ते, मैं आपकी कैसे मदद कर सकता हूँ?",
    "es": "Hola, ¿en qué puedo ayudarte hoy?",
    "fr": "Bonjour, comment puis-je vous aider ?",
    "de": "Hallo, wie kann ich Ihnen helfen?",
    "it": "Ciao, come posso aiutarti oggi?",
    "pt": "Olá, como posso ajudar você hoje?",
}

for engine in registry.get_engines():
    print(f"Warming TTS engine '{engine.name}' ...")
    if engine.name == "vits":
        langs = list(parse_vits_models(settings.vits_models))
    else:
        langs = sorted({v["language"] for v in engine.voices()})
    for lang in langs:
        t0 = time.perf_counter()
        try:
            engine.synthesize(PROBE.get(lang, "Hello."), lang, None)
            print(f"  {lang}: ready in {time.perf_counter() - t0:.1f}s")
        except Exception as e:  # noqa: BLE001
            print(f"  {lang}: FAILED — {e}")

for name, err in registry.engine_errors().items():
    print(f"Engine '{name}' unavailable: {err}")

print("Warm-up complete.")
