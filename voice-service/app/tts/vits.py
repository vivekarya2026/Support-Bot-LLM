"""Per-language VITS models (default engine). Commercial safety depends on each
model's own license, which we read from Coqui's model zoo metadata and expose on
every Voice so the admin UI can badge it."""
import threading

from ..audio import float_pcm_to_wav
from ..config import parse_vits_models, settings
from .base import LanguageUnsupported, SynthesisResult, TTSEngine, Voice

__all__ = ["VITSEngine", "LanguageUnsupported"]

# fairseq/MMS bridge models are Meta MMS checkpoints: CC-BY-NC 4.0 (non-commercial).
FAIRSEQ_LICENSE = "CC-BY-NC-4.0 (Meta MMS, non-commercial)"


class VITSEngine(TTSEngine):
    name = "vits"

    def __init__(self) -> None:
        self._models = parse_vits_models(settings.vits_models)  # lang -> (model, speaker)
        self._instances: dict[str, object] = {}
        self._lock = threading.Lock()
        self._zoo_licenses: dict[str, str] | None = None

    # -- metadata ---------------------------------------------------------
    def _license_for(self, model_name: str) -> str:
        if "fairseq" in model_name:
            return FAIRSEQ_LICENSE
        if self._zoo_licenses is None:
            self._zoo_licenses = {}
            try:
                from TTS.utils.manage import ModelManager

                manager = ModelManager(progress_bar=False)
                for full_name in manager.list_models():
                    try:
                        info = manager.model_info_by_full_name(full_name)
                        lic = (info or {}).get("license") or ""
                        if lic:
                            self._zoo_licenses[full_name] = lic
                    except Exception:  # noqa: BLE001
                        continue
            except Exception:  # noqa: BLE001
                pass
        return self._zoo_licenses.get(model_name, "unknown, verify before commercial use")

    def voices(self) -> list[Voice]:
        return [
            Voice(
                id=f"vits:{lang}",
                engine="vits",
                language=lang,
                name=f"{model.split('/')[-2]}" + (f" · {speaker}" if speaker else ""),
                license=self._license_for(model),
            )
            for lang, (model, speaker) in self._models.items()
        ]

    def supports(self, language: str) -> bool:
        return language.lower() in self._models

    def loaded(self) -> bool:
        return bool(self._instances)

    # -- synthesis --------------------------------------------------------
    def _get(self, lang: str):
        if lang not in self._instances:
            with self._lock:
                if lang not in self._instances:
                    import os

                    os.environ.setdefault("TTS_HOME", str(settings.model_cache_dir / "coqui"))
                    from TTS.api import TTS as CoquiTTS

                    model, _speaker = self._models[lang]
                    self._instances[lang] = CoquiTTS(model_name=model, progress_bar=False)
        return self._instances[lang]

    def synthesize(
        self, text: str, language: str, voice_id: str | None, speed: float = 1.0
    ) -> SynthesisResult:
        # `speed` is ignored: these VITS checkpoints have no pace control.
        lang = language.lower()
        if not self.supports(lang):
            raise LanguageUnsupported(lang)
        tts = self._get(lang)
        _model, speaker = self._models[lang]
        kwargs = {"speaker": speaker} if speaker else {}
        samples = tts.tts(text=text, **kwargs)
        sample_rate = tts.synthesizer.output_sample_rate
        return SynthesisResult(wav=float_pcm_to_wav(samples, sample_rate), sample_rate=sample_rate)
