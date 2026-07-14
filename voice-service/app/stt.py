"""faster-whisper wrapper: lazy singleton, transcription with language detection."""
import io
import threading

from .config import settings

_model = None
_lock = threading.Lock()


def is_loaded() -> bool:
    return _model is not None


def get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from faster_whisper import WhisperModel

                _model = WhisperModel(
                    settings.whisper_model,
                    device="cpu",
                    compute_type=settings.whisper_compute,
                    download_root=str(settings.model_cache_dir / "whisper"),
                )
    return _model


def transcribe(data: bytes, language_hint: str | None = None) -> dict:
    model = get_model()
    segments, info = model.transcribe(
        io.BytesIO(data),
        language=language_hint or None,
        vad_filter=True,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return {
        "text": text,
        "language": info.language,
        "language_probability": round(float(info.language_probability), 3),
        "duration_sec": round(float(info.duration), 2),
    }
