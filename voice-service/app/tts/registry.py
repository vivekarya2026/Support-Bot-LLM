"""Engine priority chain and the single home of the language-capability matrix.

Default chain: kokoro (human-quality, Apache-2.0) → vits (covers German and any
explicitly-configured legacy voices). A failed engine constructor degrades the
chain instead of killing the service.
"""
import threading

from ..config import settings
from .base import TTSEngine, Voice

_engines: list[TTSEngine] | None = None
_engine_errors: dict[str, str] = {}
_lock = threading.Lock()


def _build_engine(name: str) -> TTSEngine:
    if name == "kokoro":
        from .kokoro import KokoroEngine

        return KokoroEngine()
    if name == "xtts":
        from .xtts import XTTSEngine

        return XTTSEngine()
    if name == "vits":
        from .vits import VITSEngine

        return VITSEngine()
    raise ValueError(f"unknown TTS engine: {name}")


def _chain_spec() -> list[str]:
    spec = settings.tts_engines.strip()
    if not spec and settings.tts_engine:
        spec = settings.tts_engine  # legacy single-engine env
    names = [n.strip().lower() for n in spec.split(",") if n.strip()]
    return names or ["kokoro", "vits"]


def get_engines() -> list[TTSEngine]:
    global _engines
    if _engines is None:
        with _lock:
            if _engines is None:
                built: list[TTSEngine] = []
                for name in _chain_spec():
                    try:
                        built.append(_build_engine(name))
                    except Exception as e:  # noqa: BLE001 — degrade, don't die
                        _engine_errors[name] = str(e)
                _engines = built
    return _engines


def engine_errors() -> dict[str, str]:
    get_engines()
    return dict(_engine_errors)


def chain_name() -> str:
    return "+".join(e.name for e in get_engines()) or "none"


def catalog() -> list[Voice]:
    """All voices, priority order — earlier engines' voices are the defaults."""
    out: list[Voice] = []
    for engine in get_engines():
        out.extend(engine.voices())
    return out


def normalize_language(code: str | None) -> str:
    """ISO 639-1-ish normalization: 'en-US' -> 'en', 'HIN' -> 'hi' best effort."""
    if not code:
        return ""
    code = code.strip().lower()
    if "-" in code:
        code = code.split("-", 1)[0]
    aliases = {"hin": "hi", "eng": "en", "spa": "es", "fra": "fr", "deu": "de", "ger": "de"}
    return aliases.get(code, code)


def _lang_preference() -> dict[str, str]:
    """TTS_LANG_PREFER='hi=vits,de=vits' — per-language engine override."""
    out: dict[str, str] = {}
    for entry in settings.tts_lang_prefer.split(","):
        entry = entry.strip()
        if "=" in entry:
            lang, engine = entry.split("=", 1)
            out[normalize_language(lang)] = engine.strip().lower()
    return out


def resolve(language: str, voice_id: str | None) -> tuple[TTSEngine, Voice] | None:
    """Pick (engine, voice) for a request; None means no audio for the language."""
    engines = get_engines()
    lang = normalize_language(language)

    # Exact voice id wins, wherever it lives in the chain.
    if voice_id:
        for engine in engines:
            for v in engine.voices():
                if v["id"] == voice_id:
                    return engine, v

    preferred = _lang_preference().get(lang)
    ordered = engines
    if preferred:
        ordered = sorted(engines, key=lambda e: 0 if e.name == preferred else 1)

    for engine in ordered:
        for v in engine.voices():
            if v["language"] == lang:
                return engine, v
    return None


def languages() -> list[str]:
    return sorted({v["language"] for v in catalog()})


def any_loaded() -> bool:
    return any(e.loaded() for e in get_engines())
