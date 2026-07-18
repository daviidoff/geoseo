"""
Stage 2: Deep Research

Discovers hyper-niche keywords from Reddit, Quora, and forums.
Uses Google Search grounding to find real user language.
"""
import sys
from pathlib import Path
_BASE = Path(__file__).parent.parent
if str(_BASE) not in sys.path:
    sys.path.insert(0, str(_BASE))

from .stage_2 import run_stage_2
from .stage2_models import Stage2Input, Stage2Output

__all__ = ["run_stage_2", "Stage2Input", "Stage2Output"]
