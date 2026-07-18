"""
Stage 4: Scoring & Deduplication

Scores keywords for company-fit and removes duplicates.
"""
import sys
from pathlib import Path
_BASE = Path(__file__).parent.parent
if str(_BASE) not in sys.path:
    sys.path.insert(0, str(_BASE))

from .stage_4 import run_stage_4
from .stage4_models import Stage4Input, Stage4Output

__all__ = ["run_stage_4", "Stage4Input", "Stage4Output"]
