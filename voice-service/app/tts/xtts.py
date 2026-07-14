"""XTTS-v2 backend — OPT-IN ONLY.

The XTTS-v2 model weights are released under the Coqui Public Model License
(CPML): NON-COMMERCIAL USE ONLY. Coqui Inc. shut down in January 2024, so no
commercial license can be purchased. This engine refuses to construct unless
the operator explicitly acknowledges that constraint via environment flags.
"""
import threading

from ..audio import float_pcm_to_wav
from ..config import settings
from .base import SynthesisResult, TTSEngine, Voice

XTTS_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
XTTS_LICENSE = "CPML (non-commercial only)"
XTTS_LANGUAGES = [
    "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
    "nl", "cs", "ar", "zh", "ja", "hu", "ko", "hi",
]


class XTTSNotEnabled(RuntimeError):
    pass


class XTTSEngine(TTSEngine):
    name = "xtts"

    def __init__(self) -> None:
        if not settings.coqui_tos_agreed:
            raise XTTSNotEnabled(
                "XTTS-v2 is CPML-licensed (non-commercial only). Set COQUI_TOS_AGREED=1 "
                "and TTS_ENGINE=xtts to enable it for a non-commercial deployment."
            )
        self._instance = None
        self._lock = threading.Lock()

    def voices(self) -> list[Voice]:
        return [
            Voice(
                id=f"xtts:{lang}",
                engine="xtts",
                language=lang,
                name=f"XTTS-v2 · {settings.xtts_speaker}",
                license=XTTS_LICENSE,
            )
            for lang in XTTS_LANGUAGES
        ]

    def supports(self, language: str) -> bool:
        return language.lower() in XTTS_LANGUAGES

    def loaded(self) -> bool:
        return self._instance is not None

    def _get(self):
        if self._instance is None:
            with self._lock:
                if self._instance is None:
                    import os

                    os.environ["COQUI_TOS_AGREED"] = "1"
                    os.environ.setdefault("TTS_HOME", str(settings.model_cache_dir / "coqui"))
                    from TTS.api import TTS as CoquiTTS

                    self._instance = CoquiTTS(model_name=XTTS_MODEL, progress_bar=False)
        return self._instance

    def synthesize(
        self, text: str, language: str, voice_id: str | None, speed: float = 1.0
    ) -> SynthesisResult:
        from .base import LanguageUnsupported

        lang = language.lower()
        if not self.supports(lang):
            raise LanguageUnsupported(lang)
        tts = self._get()
        kwargs: dict = {"language": lang, "speed": max(0.5, min(1.5, float(speed)))}
        if settings.xtts_speaker_wav:
            kwargs["speaker_wav"] = settings.xtts_speaker_wav
        else:
            kwargs["speaker"] = settings.xtts_speaker
        samples = tts.tts(text=text, **kwargs)
        sample_rate = tts.synthesizer.output_sample_rate
        return SynthesisResult(wav=float_pcm_to_wav(samples, sample_rate), sample_rate=sample_rate)
