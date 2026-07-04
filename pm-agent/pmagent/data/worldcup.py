"""World Cup 2026 dataset loader.

The JSON dataset carries per-field provenance (result_source / price_source /
confidence) so the engine and the UI can always disclose data quality. When live
Polymarket + recorded odds data become available, a live loader replaces this one
behind the same `load_matches()` shape and the fidelity level rises accordingly.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Tuple

from ..models import MatchRecord

_DATA_PATH = Path(__file__).parent / "worldcup2026.json"


def load_dataset() -> dict:
    with open(_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_matches(stage: str = "round_of_32") -> Tuple[List[MatchRecord], dict]:
    """Return (matches, dataset metadata). Matches sorted by kickoff time."""
    raw = load_dataset()
    matches = [MatchRecord(**m) for m in raw["matches"] if m["stage"] == stage]
    matches.sort(key=lambda m: m.kickoff_utc)
    meta = {k: v for k, v in raw.items() if k != "matches"}
    return matches, meta
