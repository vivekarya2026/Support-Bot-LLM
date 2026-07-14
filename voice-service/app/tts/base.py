"""Engine abstraction: every TTS backend answers the same three questions —
which voices exist, which languages work, and how to synthesize."""
from abc import ABC, abstractmethod
from typing import TypedDict


class Voice(TypedDict):
    id: str        # stable identifier, e.g. "vits:en" or "xtts:hi"
    engine: str    # "vits" | "xtts"
    language: str  # ISO 639-1
    name: str      # human label for the admin picker
    license: str   # e.g. "apache-2.0", "CC-BY-NC-4.0", "CPML (non-commercial)"


class SynthesisResult(TypedDict):
    wav: bytes           # complete WAV file bytes (16-bit mono)
    sample_rate: int


class LanguageUnsupported(Exception):
    def __init__(self, language: str) -> None:
        self.language = language
        super().__init__(f"language_unsupported: {language}")


class TTSEngine(ABC):
    name: str

    @abstractmethod
    def voices(self) -> list[Voice]: ...

    @abstractmethod
    def supports(self, language: str) -> bool: ...

    @abstractmethod
    def synthesize(
        self, text: str, language: str, voice_id: str | None, speed: float = 1.0
    ) -> SynthesisResult:
        """`speed` is best-effort: engines without a pace control ignore it."""

    def loaded(self) -> bool:
        """True when at least one model is resident in memory."""
        return False
