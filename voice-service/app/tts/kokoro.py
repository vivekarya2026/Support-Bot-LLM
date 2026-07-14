"""Kokoro-82M — the default engine. Apache-2.0 weights (commercially safe),
54 voices across 8 languages, 24 kHz output, CPU real-time.

Voice ids are `kokoro:<pack>` (e.g. `kokoro:af_heart`). The voice-pack prefix
encodes the G2P pipeline: `a`=American English, `b`=British English, `h`=Hindi,
`e`=Spanish, `f`=French, `i`=Italian, `p`=Brazilian Portuguese. Japanese and
Mandarin exist upstream but need the misaki[ja]/[zh] extras — excluded here.
"""
import os
import threading

import numpy as np

from ..audio import float_pcm_to_wav
from ..config import settings
from .base import LanguageUnsupported, SynthesisResult, TTSEngine, Voice

KOKORO_LICENSE = "Apache-2.0"
SAMPLE_RATE = 24_000
LANG_CODES = {"en": "a", "hi": "h", "es": "e", "fr": "f", "it": "i", "pt": "p"}
SEGMENT_GAP_S = 0.12  # breath-length pause between pipeline segments

# (voice pack, language, display name) — curated subset of the 54 packs.
CURATED_VOICES: list[tuple[str, str, str]] = [
    ("af_heart", "en", "Heart - warm American female"),
    ("af_bella", "en", "Bella - bright American female"),
    ("af_nicole", "en", "Nicole - soft-spoken American female"),
    ("am_michael", "en", "Michael - calm American male"),
    ("am_fenrir", "en", "Fenrir - energetic American male"),
    ("bf_emma", "en", "Emma - warm British female"),
    ("bm_george", "en", "George - measured British male"),
    ("hf_alpha", "hi", "Alpha - clear Hindi female"),
    ("hm_omega", "hi", "Omega - steady Hindi male"),
    ("ef_dora", "es", "Dora - friendly Spanish female"),
    ("em_alex", "es", "Alex - Spanish male"),
    ("ff_siwis", "fr", "Siwis - French female"),
    ("if_sara", "it", "Sara - Italian female"),
    ("im_nicola", "it", "Nicola - Italian male"),
    ("pf_dora", "pt", "Dora - Brazilian Portuguese female"),
    ("pm_alex", "pt", "Alex - Brazilian Portuguese male"),
]


class KokoroEngine(TTSEngine):
    name = "kokoro"

    def __init__(self) -> None:
        # Keep model downloads beside the coqui/whisper caches.
        os.environ.setdefault("HF_HOME", str(settings.model_cache_dir / "hf"))
        self._model = None
        self._pipelines: dict[str, object] = {}
        self._lock = threading.Lock()
        self._by_language: dict[str, list[tuple[str, str]]] = {}
        for pack, lang, label in CURATED_VOICES:
            self._by_language.setdefault(lang, []).append((pack, label))

    # -- metadata ---------------------------------------------------------
    def voices(self) -> list[Voice]:
        return [
            Voice(
                id=f"kokoro:{pack}",
                engine="kokoro",
                language=lang,
                name=label,
                license=KOKORO_LICENSE,
            )
            for pack, lang, label in CURATED_VOICES
        ]

    def supports(self, language: str) -> bool:
        return language.lower() in self._by_language

    def loaded(self) -> bool:
        return bool(self._pipelines)

    # -- synthesis --------------------------------------------------------
    def _get_pipeline(self, lang_code: str):
        if lang_code not in self._pipelines:
            with self._lock:
                if lang_code not in self._pipelines:
                    from kokoro import KModel, KPipeline

                    if self._model is None:
                        self._model = KModel()
                        self._model.eval()
                    self._pipelines[lang_code] = KPipeline(
                        lang_code=lang_code, model=self._model
                    )
        return self._pipelines[lang_code]

    def _resolve_pack(self, language: str, voice_id: str | None) -> str:
        lang = language.lower()
        packs = self._by_language.get(lang)
        if not packs:
            raise LanguageUnsupported(lang)
        if voice_id:
            pack = voice_id.split(":", 1)[-1]
            # A stale bot config can point a language at the wrong pack;
            # fall back to the language default rather than erroring.
            if any(pack == p for p, _ in packs):
                return pack
        return packs[0][0]

    def synthesize(
        self, text: str, language: str, voice_id: str | None, speed: float = 1.0
    ) -> SynthesisResult:
        pack = self._resolve_pack(language, voice_id)
        # British packs need the 'b' pipeline; everything else maps by language.
        lang_code = "b" if pack.startswith("b") else LANG_CODES[language.lower()]
        pipeline = self._get_pipeline(lang_code)
        speed = max(0.5, min(1.5, float(speed)))

        segments: list[np.ndarray] = []
        gap = np.zeros(int(SAMPLE_RATE * SEGMENT_GAP_S), dtype=np.float32)
        for result in pipeline(text, voice=pack, speed=speed):
            audio = result.audio
            if audio is None:
                continue
            arr = audio.detach().cpu().numpy().astype(np.float32).reshape(-1)
            if segments:
                segments.append(gap)
            segments.append(arr)
        if not segments:
            samples = np.zeros(0, dtype=np.float32)
        else:
            samples = np.concatenate(segments)
        return SynthesisResult(
            wav=float_pcm_to_wav(samples, SAMPLE_RATE), sample_rate=SAMPLE_RATE
        )
