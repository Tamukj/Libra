"""Locale loader connecting locales/*.json to API, narrative, and PDF generators."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any

_LOCALES_DIR = Path(__file__).resolve().parent.parent.parent / "locales"
SUPPORTED_LANGS = ("ru", "kz", "en")


@lru_cache(maxsize=8)
def get_locale(lang: str = "ru") -> Dict[str, Any]:
    """Loads localization dictionary for 'ru', 'kz', or 'en', defaulting to 'ru'."""
    norm_lang = lang if lang in SUPPORTED_LANGS else "ru"
    path = _LOCALES_DIR / f"{norm_lang}.json"
    if not path.exists():
        path = _LOCALES_DIR / "ru.json"
    return json.loads(path.read_text(encoding="utf-8"))
