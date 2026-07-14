"""Audio utilities and speech-text sanitization."""
import io
import re
import struct
import wave


def sanitize_for_speech(text: str) -> str:
    """Strip chat markup so TTS never reads 'bracket one' or 'asterisk asterisk'.

    Bot replies deliberately contain [n] citation markers and markdown; none of
    it belongs in audio.
    """
    # fenced code blocks -> a spoken placeholder
    text = re.sub(r"```.*?```", " code example omitted. ", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    # citation markers like [1], [12]
    text = re.sub(r"\[\d+\]", "", text)
    # markdown links [label](url) -> label
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # bare urls -> spoken placeholder
    text = re.sub(r"https?://\S+", " a link ", text)
    # headers, blockquotes, bullets, numbered lists at line starts
    text = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+", "", text, flags=re.MULTILINE)
    # emphasis
    text = re.sub(r"(\*\*|__|\*|_|~~)", "", text)
    # tables -> spaces
    text = text.replace("|", " ")
    # collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def float_pcm_to_wav(samples, sample_rate: int) -> bytes:
    """Convert float samples in [-1, 1] to 16-bit mono WAV bytes.

    Vectorized when numpy is available (24 kHz Kokoro output makes the
    per-sample struct loop noticeably slow); falls back for plain sequences.
    """
    try:
        import numpy as np

        arr = np.asarray(samples, dtype=np.float32).reshape(-1)
        frames = (np.clip(arr, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()
    except Exception:  # noqa: BLE001 — numpy missing or exotic input
        parts = bytearray()
        for s in samples:
            v = max(-1.0, min(1.0, float(s)))
            parts += struct.pack("<h", int(v * 32767))
        frames = bytes(parts)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(frames)
    return buf.getvalue()


def probe_duration_seconds(data: bytes) -> float | None:
    """Best-effort container duration probe via PyAV; None when unknown."""
    import av

    try:
        with av.open(io.BytesIO(data)) as container:
            if container.duration is not None:
                return container.duration / 1_000_000
            stream = next((s for s in container.streams if s.type == "audio"), None)
            if stream is not None and stream.duration and stream.time_base:
                return float(stream.duration * stream.time_base)
    except Exception:  # noqa: BLE001 — a broken upload is handled downstream
        return None
    return None
