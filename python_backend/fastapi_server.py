"""
Standalone Enterprise Python FastAPI Backend for Prabhat Personal AI Agent.
Use this in VS Code / Antigravity when running the backend natively in Python:
  pip install -r python_backend/requirements.txt
  uvicorn python_backend.fastapi_server:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
import platform
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from python_backend.nlp_engine import MultilingualNlpEngine

load_dotenv()

CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"
nlp_engine = MultilingualNlpEngine()

app = FastAPI(
    title="Prabhat Personal AI Agent - Python Enterprise API",
    description="Multilingual Indian Voice & Calendar AI Orchestration API built by Prabhat Kumar.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str
    languageHint: str = "auto"
    timeZone: str = "Asia/Kolkata"


class SuggestSlotsRequest(BaseModel):
    busySlots: list[dict[str, str]] = []
    targetDate: str | None = None
    durationMinutes: int = 30
    timeZone: str = "Asia/Kolkata"
    maxSuggestions: int = 5


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Google Calendar Bearer token.")
    return authorization.removeprefix("Bearer ").strip()


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "agent": "Prabhat Personal AI Agent",
        "runtime": f"Python {platform.python_version()}",
        "geminiConfigured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.get("/api/python/status")
async def python_status() -> dict[str, Any]:
    return {
        **nlp_engine.get_status(),
        "pythonVersion": platform.python_version(),
        "pid": os.getpid(),
    }


@app.post("/api/python/analyze")
async def analyze_utterance(req: AnalyzeRequest) -> dict[str, Any]:
    return nlp_engine.analyze_utterance(
        text=req.text,
        language_hint=req.languageHint,
        time_zone=req.timeZone,
    )


@app.post("/api/python/suggest-slots")
async def suggest_slots(req: SuggestSlotsRequest) -> dict[str, Any]:
    return nlp_engine.suggest_optimal_slots(
        busy_slots=req.busySlots,
        target_date=req.targetDate,
        duration_minutes=req.durationMinutes,
        time_zone=req.timeZone,
        max_suggestions=req.maxSuggestions,
    )


@app.get("/api/calendar/profile")
async def calendar_profile(authorization: str | None = Header(default=None)) -> Any:
    token = _extract_bearer(authorization)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{CALENDAR_BASE}/calendars/primary",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


@app.get("/api/calendar/events")
async def list_events(
    timeMin: str,
    timeMax: str,
    q: str | None = None,
    authorization: str | None = Header(default=None),
) -> Any:
    token = _extract_bearer(authorization)
    params = {
        "singleEvents": "true",
        "orderBy": "startTime",
        "timeMin": timeMin,
        "timeMax": timeMax,
        "maxResults": "50",
    }
    if q:
        params["q"] = q

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{CALENDAR_BASE}/calendars/primary/events",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
