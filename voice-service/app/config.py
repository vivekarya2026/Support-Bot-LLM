"""Environment-driven configuration for the voice service."""
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # STT
    whisper_model: str = "small"          # tiny | base | small | medium
    whisper_compute: str = "int8"         # CTranslate2 compute type (CPU-safe)
    max_stt_seconds: float = 120.0

    # TTS
    # Priority chain: earlier engines are the per-language defaults.
    tts_engines: str = "kokoro,vits"
    tts_engine: str = ""                  # legacy single-engine override
    tts_lang_prefer: str = ""             # e.g. "hi=vits" — per-language engine override
    # comma-separated lang=model_name[#speaker]
    vits_models: str = (
        "en=tts_models/en/vctk/vits#p225,"
        "hi=tts_models/hin/fairseq/vits,"
        "es=tts_models/es/css10/vits,"
        "fr=tts_models/fr/css10/vits,"
        "de=tts_models/de/thorsten/vits"
    )
    max_tts_chars: int = 2000

    # XTTS-v2 is CPML-licensed: NON-COMMERCIAL USE ONLY. Both flags below must be
    # set for the engine to load; this is a deliberate speed bump, not bureaucracy.
    coqui_tos_agreed: bool = False
    xtts_speaker: str = "Claribel Dervla"  # built-in reference speaker
    xtts_speaker_wav: str = ""             # optional path to a reference clip

    model_cache_dir: Path = Path.home() / ".cache" / "supportkit-voice"

    # Max concurrent heavy jobs (synthesis/transcription) — protects the host.
    max_concurrency: int = 2

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
settings.model_cache_dir.mkdir(parents=True, exist_ok=True)


def parse_vits_models(spec: str) -> dict[str, tuple[str, str | None]]:
    """'en=path#speaker,de=path' -> {'en': ('path', 'speaker'), 'de': ('path', None)}"""
    out: dict[str, tuple[str, str | None]] = {}
    for entry in spec.split(","):
        entry = entry.strip()
        if not entry or "=" not in entry:
            continue
        lang, model = entry.split("=", 1)
        speaker: str | None = None
        if "#" in model:
            model, speaker = model.split("#", 1)
        out[lang.strip().lower()] = (model.strip(), speaker or None)
    return out
