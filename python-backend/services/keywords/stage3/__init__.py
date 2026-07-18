"""
Stage 3: AI Keyword Generation

Generates keywords using Gemini AI based on company context.
Also includes autocomplete and gap analysis keywords.
"""
import sys
from pathlib import Path
_BASE = Path(__file__).parent.parent
if str(_BASE) not in sys.path:
    sys.path.insert(0, str(_BASE))

from .stage_3 import run_stage_3
from .stage3_models import Stage3Input, Stage3Output

__all__ = ["run_stage_3", "Stage3Input", "Stage3Output"]
