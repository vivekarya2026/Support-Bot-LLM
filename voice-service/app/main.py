"""SupportKit voice service — loopback-only FastAPI app.

Only the Next.js server talks to this process. It never sees botKeys or user
identity; auth and per-bot policy live in the Next.js proxy routes.
"""
import asyncio

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import stt
from .audio import probe_duration_seconds, sanitize_for_speech
from .config import settings
from .tts import registry
from .tts.base import LanguageUnsupported

app = FastAPI(title="supportkit-voice", docs_url=None, redoc_url=None)

# Transcription and synthesis are CPU-heavy; cap concurrency so a burst of
# requests can't take down the host.
_semaphore = asyncio.Semaphore(settings.max_concurrency)


@app.get("/health")
async def health():
    try:
        engines = [
            {"name": e.name, "loaded": e.loaded(), "languages": sorted({v["language"] for v in e.voices()})}
            for e in registry.get_engines()
        ]
        for name, err in registry.engine_errors().items():
            engines.append({"name": name, "loaded": False, "error": err})
        tts_info = {
            "engine": registry.chain_name(),
            "loaded": registry.any_loaded(),
            "languages": registry.languages(),
            "engines": engines,
        }
    except Exception as e:  # noqa: BLE001
        tts_info = {"engine": "none", "loaded": False, "languages": [], "error": str(e)}
    return {
        "ok": True,
        "stt": {"model": settings.whisper_model, "loaded": stt.is_loaded()},
        "tts": tts_info,
    }


@app.get("/voices")
async def voices():
    try:
        return {"voices": registry.catalog()}
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=503, content={"error": str(e)})


@app.post("/stt")
async def transcribe(file: UploadFile = File(...), language: str | None = Form(None)):
    data = await file.read()
    if not data:
        return JSONResponse(status_code=400, content={"error": "empty audio"})
    duration = probe_duration_seconds(data)
    if duration is not None and duration > settings.max_stt_seconds:
        return JSONResponse(
            status_code=413,
            content={"error": "audio too long", "max_seconds": settings.max_stt_seconds},
        )
    hint = registry.normalize_language(language) or None
    async with _semaphore:
        result = await run_in_threadpool(stt.transcribe, data, hint)
    return result


class TtsRequest(BaseModel):
    text: str
    language: str = "en"
    voice_id: str | None = None
    speed: float = 1.0


@app.post("/tts")
async def synthesize(req: TtsRequest):
    text = sanitize_for_speech(req.text)[: settings.max_tts_chars]
    if not text:
        return JSONResponse(status_code=400, content={"error": "empty text"})
    lang = registry.normalize_language(req.language) or "en"
    resolved = registry.resolve(lang, req.voice_id)
    if resolved is None:
        return JSONResponse(
            status_code=422, content={"error": "language_unsupported", "language": lang}
        )
    engine, voice = resolved
    speed = max(0.5, min(1.5, req.speed))
    try:
        async with _semaphore:
            result = await run_in_threadpool(
                engine.synthesize, text, voice["language"], voice["id"], speed
            )
    except LanguageUnsupported:
        return JSONResponse(
            status_code=422, content={"error": "language_unsupported", "language": lang}
        )
    def ascii_header(value: str) -> str:
        return value.encode("ascii", "replace").decode("ascii")

    return Response(
        content=result["wav"],
        media_type="audio/wav",
        headers={
            "X-Voice-Id": ascii_header(voice["id"]),
            "X-Voice-License": ascii_header(voice["license"]),
        },
    )
