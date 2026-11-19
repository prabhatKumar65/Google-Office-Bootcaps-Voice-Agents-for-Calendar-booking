"""
Multilingual Indian NLP Intent Classifier, Entity Extractor, and Slot Optimizer
for Prabhat Personal AI Agent.

Uses pure Python 3.10+ standard library so it executes natively in any environment
(including constrained containers without pip) as well as inside FastAPI services.
"""

from __future__ import annotations

import re
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo


SCRIPT_RANGES = {
    "devanagari": re.compile(r"[\u0900-\u097F]"),
    "tamil": re.compile(r"[\u0B80-\u0BFF]"),
    "telugu": re.compile(r"[\u0C00-\u0C7F]"),
}

BHOJPURI_MARKERS = {
    "बिहान", "भोर", "सांझ", "सँझिया", "एगो", "केतना", "रउआ", "हमरा", "बाटे", "बानी",
    "कइल", "करब", "bihaan", "bihan", "sanjh", "sanjhiya", "ketna", "raua", "hamra",
    "karab", "ego", "bate",
}

MARATHI_MARKERS = {
    "उद्या", "सकाळी", "संध्याकाळी", "रद्द", "करा", "माझी", "आहे", "बैठक", "दुपारी",
    "udya", "sakali", "sandhyakali", "radd", "baithak", "dupari", "mazi",
}

HINDI_MARKERS = {
    "कल", "परसों", "आज", "मीटिंग", "सुबह", "शाम", "दोपहर", "बजे", "बुक", "कैंसल",
    "रिशेड्यूल", "खाली", "समय", "तारीख", "मेरा", "मेरी", "kal", "parso", "aaj",
    "subah", "shaam", "baje", "khali", "samay",
}

TAMIL_MARKERS = {
    "நாளைக்கு", "காலை", "மதியம்", "மாலை", "சாயங்காலம்", "ரத்து", "நேரம்",
    "naalaiku", "nalai", "kaalai", "madhiyam", "maalai", "rattu",
}

TELUGU_MARKERS = {
    "రేపు", "ఉదయం", "మధ్యాహ్నం", "సాయంత్రం", "రద్దు", "సమయం", "మీటింగ్",
    "repu", "udayam", "madhyahnam", "sayantram", "raddu",
}

INTENT_PATTERNS: dict[str, list[str]] = {
    "identity_query": [
        "who are you", "what is your name", "your name", "who built you",
        "who created you", "who developed you", "who made you",
        "तुम कौन हो", "तुम्हारा नाम", "किसने बनाया", "किसने डेवलप",
        "तु के हव", "रउआ के बानी", "के बनवले",
        "நீங்கள் யார்", "உங்கள் பெயர்", "யார் உருவாக்கினார்கள்",
        "तुम्ही कोण", "तुमचे नाव", "कोणी बनवले",
        "మీరు ఎవరు", "మీ పేరు", "ఎవరు తయారు",
    ],
    "cancel_appointment": [
        "cancel", "delete", "remove", "drop", "call off",
        "कैंसल", "रद्द", "हटा", "मिटा", "cancel karo", "radd kara",
        "ரத்து", "நீக்கு", "రద్దు", "తొలగించు",
    ],
    "reschedule_appointment": [
        "reschedule", "move", "postpone", "shift", "change time", "update",
        "बदल", "शिफ्ट", "आगे बढ़ा", "टाल", "reschedule karo", "badla",
        "மாற்று", "தள்ளி", "మార్చు", "వాయిదా",
    ],
    "check_availability": [
        "available", "availability", "free", "slot", "busy", "open time",
        "खाली", "स्लॉट", "फ्री", "उपलब्ध", "khali hai", "free hai",
        "நேரம் இருக்கா", "रिकामे", "फ्री आहे", "ఖాళీ", "అందుబాటు",
    ],
    "list_events": [
        "list", "show", "what is on", "my schedule", "upcoming", "agenda", "events",
        "दिखाओ", "कौन सी मीटिंग", "शेड्यूल", "लिस्ट", "बताओ", "kya hai",
        "பட்டியல்", "நிகழ்வுகள்", "वेळापत्रक", "कार्यक्रम", "షెడ్యూల్",
    ],
    "book_appointment": [
        "book", "schedule", "set up", "setup", "create", "fix", "arrange", "appointment",
        "बुक", "रख", "लगा", "फिक्स", "नियोजित", "karo", "karab", "ठेवा",
        "பதிவு", "அமை", "బుక్", "ఏర్పాటు",
    ],
}

RELATIVE_DAY_OFFSETS: list[tuple[tuple[str, ...], int, str]] = [
    (("day after tomorrow", "परसों", "परसो", "parso", "परवा", "parva", "நாளை மறுநாள்", "ఎల్లుండి"), 2, "+2 days"),
    (("tomorrow", "कल", "kal", "बिहान", "bihaan", "bihan", "उद्या", "udya", "நாளைக்கு", "நாளை", "naalaiku", "రేపు", "repu"), 1, "tomorrow"),
    (("today", "आज", "aaj", "आजु", "aaju", "आजुक", "இன்று", "indru", "ఈరోజు", "eroju"), 0, "today"),
]

DAY_PERIODS: list[tuple[tuple[str, ...], str, int]] = [
    (("morning", "सुबह", "subah", "भोर", "bhor", "सकाळी", "sakali", "காலை", "kaalai", "ఉదయం", "udayam"), "morning", 10),
    (("afternoon", "दोपहर", "dopahar", "दुपारी", "dupari", "மதியம்", "madhiyam", "మధ్యాహ్నం", "madhyahnam"), "afternoon", 14),
    (("evening", "शाम", "shaam", "सांझ", "सँझिया", "sanjh", "संध्याकाळी", "sandhyakali", "மாலை", "சாயங்காலம்", "maalai", "సాయంత్రం", "sayantram"), "evening", 17),
    (("night", "रात", "raat", "रात्री", "இரவு", "రాత్రి"), "night", 20),
]

TIME_REGEX = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|बजे|baje|वाजता|மணிக்கு|గంటలకు)?\b", re.IGNORECASE)
DURATION_REGEX = re.compile(r"\b(\d{1,3})\s*(min|mins|minute|minutes|मिनट|hr|hrs|hour|hours|घंटा|घंटे)\b", re.IGNORECASE)


@dataclass
class EngineMetrics:
    started_at: float = field(default_factory=time.time)
    total_utterances: int = 0
    total_latency_ms: float = 0.0
    intent_counts: dict[str, int] = field(default_factory=dict)
    language_counts: dict[str, int] = field(default_factory=dict)
    slot_optimizations_run: int = 0


class MultilingualNlpEngine:
    def __init__(self) -> None:
        self.metrics = EngineMetrics()

    def detect_language_and_script(self, text: str, hint: str = "auto") -> dict[str, str]:
        lower = text.lower()
        tokens = set(re.findall(r"[\w\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F]+", lower))

        if SCRIPT_RANGES["tamil"].search(text):
            return {"language": "Tamil", "script": "Tamil", "code": "ta"}
        if SCRIPT_RANGES["telugu"].search(text):
            return {"language": "Telugu", "script": "Telugu", "code": "te"}
        if SCRIPT_RANGES["devanagari"].search(text):
            if tokens & BHOJPURI_MARKERS:
                return {"language": "Bhojpuri", "script": "Devanagari", "code": "bho"}
            if tokens & MARATHI_MARKERS:
                return {"language": "Marathi", "script": "Devanagari", "code": "mr"}
            if hint in ("bho", "mr", "hi"):
                labels = {"bho": "Bhojpuri", "mr": "Marathi", "hi": "Hindi"}
                return {"language": labels[hint], "script": "Devanagari", "code": hint}
            return {"language": "Hindi", "script": "Devanagari", "code": "hi"}

        if tokens & BHOJPURI_MARKERS:
            return {"language": "Bhojpuri (Romanized)", "script": "Latin", "code": "bho"}
        if tokens & MARATHI_MARKERS:
            return {"language": "Marathi (Romanized)", "script": "Latin", "code": "mr"}
        if tokens & TAMIL_MARKERS:
            return {"language": "Tanglish / Tamil", "script": "Latin", "code": "ta"}
        if tokens & TELUGU_MARKERS:
            return {"language": "Tenglish / Telugu", "script": "Latin", "code": "te"}
        if tokens & HINDI_MARKERS:
            return {"language": "Hinglish / Hindi", "script": "Latin", "code": "hi"}

        hint_map = {
            "hi": "Hindi",
            "bho": "Bhojpuri",
            "ta": "Tamil",
            "mr": "Marathi",
            "te": "Telugu",
            "en": "English",
            "auto": "English / Auto",
        }
        return {"language": hint_map.get(hint, "English"), "script": "Latin", "code": hint}

    def analyze_utterance(
        self,
        text: str,
        language_hint: str = "auto",
        time_zone: str = "Asia/Kolkata",
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        cleaned = (text or "").strip()
        lower = cleaned.lower()

        lang_info = self.detect_language_and_script(cleaned, language_hint)

        scores: dict[str, int] = {}
        matched_cues: list[str] = []
        for intent, patterns in INTENT_PATTERNS.items():
            hits = [p for p in patterns if p in lower]
            if hits:
                scores[intent] = len(hits)
                matched_cues.extend(hits[:2])

        if scores:
            best_intent = max(scores.items(), key=lambda item: item[1])[0]
            confidence = min(0.98, 0.72 + 0.08 * scores[best_intent])
        else:
            best_intent = "general_scheduling"
            confidence = 0.55

        tz = ZoneInfo(time_zone) if time_zone else ZoneInfo("Asia/Kolkata")
        now_local = datetime.now(tz)

        resolved_date = None
        date_label = None
        for aliases, offset_days, label in RELATIVE_DAY_OFFSETS:
            if any(alias in lower for alias in aliases):
                target = now_local + timedelta(days=offset_days)
                resolved_date = target.strftime("%Y-%m-%d")
                date_label = label
                break

        period_label = None
        period_default_hour = None
        for aliases, label, default_hour in DAY_PERIODS:
            if any(alias in lower for alias in aliases):
                period_label = label
                period_default_hour = default_hour
                break

        extracted_time = None
        m = TIME_REGEX.search(cleaned)
        if m:
            hour = int(m.group(1))
            minute = int(m.group(2) or 0)
            suffix = (m.group(3) or "").lower()
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                if suffix in ("pm", "p.m.") and hour < 12:
                    hour += 12
                elif suffix in ("am", "a.m.") and hour == 12:
                    hour = 0
                elif not suffix or suffix in ("बजे", "baje", "वाजता", "மணிக்கு", "గంటలకు"):
                    if period_label in ("afternoon", "evening", "night") and 1 <= hour <= 11:
                        hour += 12
                    elif period_label is None and 1 <= hour <= 7:
                        hour += 12
                extracted_time = f"{hour:02d}:{minute:02d}"
        elif period_default_hour is not None:
            extracted_time = f"{period_default_hour:02d}:00"

        duration_minutes = 30
        dm = DURATION_REGEX.search(cleaned)
        if dm:
            val = int(dm.group(1))
            unit = dm.group(2).lower()
            if unit in ("hr", "hrs", "hour", "hours", "घंटा", "घंटे"):
                duration_minutes = min(480, max(15, val * 60))
            else:
                duration_minutes = min(480, max(10, val))

        wants_meet = any(
            kw in lower
            for kw in ("google meet", "meet", "video", "online", "ऑनलाइन", "वीडियो", "मीट")
        )

        latency_ms = round((time.perf_counter() - t0) * 1000, 3)

        self.metrics.total_utterances += 1
        self.metrics.total_latency_ms += latency_ms
        self.metrics.intent_counts[best_intent] = (
            self.metrics.intent_counts.get(best_intent, 0) + 1
        )
        self.metrics.language_counts[lang_info["language"]] = (
            self.metrics.language_counts.get(lang_info["language"], 0) + 1
        )

        return {
            "text": cleaned,
            "intent": best_intent,
            "confidence": round(confidence, 2),
            "language": lang_info["language"],
            "languageCode": lang_info["code"],
            "script": lang_info["script"],
            "entities": {
                "resolvedDate": resolved_date,
                "dateLabel": date_label,
                "dayPeriod": period_label,
                "time24h": extracted_time,
                "durationMinutes": duration_minutes,
                "wantsGoogleMeet": wants_meet,
                "matchedCues": matched_cues,
            },
            "latencyMs": latency_ms,
        }

    def suggest_optimal_slots(
        self,
        busy_slots: list[dict[str, str]],
        target_date: str | None = None,
        duration_minutes: int = 30,
        time_zone: str = "Asia/Kolkata",
        max_suggestions: int = 5,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        tz = ZoneInfo(time_zone) if time_zone else ZoneInfo("Asia/Kolkata")
        now_local = datetime.now(tz)

        if target_date:
            base_day = datetime.strptime(target_date[:10], "%Y-%m-%d").replace(tzinfo=tz)
        else:
            base_day = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

        work_start = base_day.replace(hour=9, minute=0, second=0, microsecond=0)
        work_end = base_day.replace(hour=19, minute=0, second=0, microsecond=0)

        # Round up start to next 30-min block if target date is today
        if base_day.date() == now_local.date() and now_local > work_start:
            minute_block = 30 if now_local.minute < 30 else 60
            candidate = now_local.replace(minute=0, second=0, microsecond=0) + timedelta(
                minutes=minute_block
            )
            if candidate > work_start:
                work_start = candidate

        parsed_busy: list[tuple[datetime, datetime]] = []
        for slot in busy_slots:
            s_raw = slot.get("start")
            e_raw = slot.get("end")
            if not s_raw or not e_raw:
                continue
            try:
                s_dt = datetime.fromisoformat(s_raw.replace("Z", "+00:00")).astimezone(tz)
                e_dt = datetime.fromisoformat(e_raw.replace("Z", "+00:00")).astimezone(tz)
                parsed_busy.append((s_dt, e_dt))
            except ValueError:
                continue

        candidates: list[dict[str, Any]] = []
        cursor = work_start
        delta = timedelta(minutes=max(15, duration_minutes))
        step = timedelta(minutes=30)

        while cursor + delta <= work_end:
            slot_end = cursor + delta
            overlaps = any(not (slot_end <= b_start or cursor >= b_end) for b_start, b_end in parsed_busy)
            if not overlaps:
                # Score ergonomic preference (10:00-12:00 & 14:30-17:00 preferred)
                hour_float = cursor.hour + cursor.minute / 60.0
                if 10.0 <= hour_float <= 12.0:
                    tier = "Optimal morning window"
                    rank = 1
                elif 14.5 <= hour_float <= 17.0:
                    tier = "Focus afternoon window"
                    rank = 2
                else:
                    tier = "Available slot"
                    rank = 3

                candidates.append(
                    {
                        "startIso": cursor.isoformat(),
                        "endIso": slot_end.isoformat(),
                        "label": f"{cursor.strftime('%I:%M %p')} - {slot_end.strftime('%I:%M %p')}",
                        "rationale": tier,
                        "rank": rank,
                    }
                )
            cursor += step

        candidates.sort(key=lambda c: (c["rank"], c["startIso"]))
        top = candidates[:max_suggestions]
        self.metrics.slot_optimizations_run += 1

        return {
            "date": base_day.strftime("%Y-%m-%d"),
            "timeZone": time_zone,
            "durationMinutes": duration_minutes,
            "suggestions": top,
            "totalFreeFound": len(candidates),
            "latencyMs": round((time.perf_counter() - t0) * 1000, 3),
        }

    def get_status(self) -> dict[str, Any]:
        avg_latency = (
            round(self.metrics.total_latency_ms / self.metrics.total_utterances, 3)
            if self.metrics.total_utterances > 0
            else 0.0
        )
        return {
            "status": "ready",
            "uptimeSeconds": round(time.time() - self.metrics.started_at, 1),
            "totalUtterancesAnalyzed": self.metrics.total_utterances,
            "averageLatencyMs": avg_latency,
            "slotOptimizationsRun": self.metrics.slot_optimizations_run,
            "intentCounts": self.metrics.intent_counts,
            "languageCounts": self.metrics.language_counts,
        }
