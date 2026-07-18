"""
Unified Prompt Loader for all services.

Loads prompts from the prompts/ directory with path traversal protection.
"""

import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Valid prompt folders (whitelist for security)
VALID_FOLDERS = {
    # Blog pipeline stages
    "stage1", "stage2", "stage3", "stage4", "stage5", "stage_refresh",
    # Context extraction
    "opencontext",
    # Keywords pipeline
    "keywords",
    # Shared prompts
    "shared",
}


class PromptLoader:
    """
    Load and format prompts from the prompts/ directory.

    Usage:
        loader = PromptLoader()
        prompt = loader.load("stage1", "system.txt", company_name="Stripe")
    """

    def __init__(self, prompts_dir: Optional[Path] = None):
        """
        Initialize prompt loader.

        Args:
            prompts_dir: Override prompts directory (defaults to ./prompts/)
        """
        if prompts_dir:
            self.prompts_dir = Path(prompts_dir)
        else:
            # Default to prompts/ in mono-python-service root
            self.prompts_dir = Path(__file__).parent.parent / "prompts"

    def load(
        self,
        folder: str,
        filename: str,
        **format_kwargs,
    ) -> str:
        """
        Load and format a prompt file.

        Args:
            folder: Prompt folder (must be in VALID_FOLDERS)
            filename: Prompt filename
            **format_kwargs: Variables to substitute in prompt

        Returns:
            Formatted prompt string

        Raises:
            ValueError: If folder is invalid or file not found
        """
        # Validate folder (security)
        if folder not in VALID_FOLDERS:
            raise ValueError(
                f"Invalid prompt folder: {folder}. "
                f"Valid folders: {sorted(VALID_FOLDERS)}"
            )

        # Validate filename (no path traversal)
        if ".." in filename or "/" in filename or "\\" in filename:
            raise ValueError(f"Invalid filename: {filename}")

        # Build path
        prompt_path = self.prompts_dir / folder / filename

        # Check file exists
        if not prompt_path.is_file():
            raise ValueError(f"Prompt file not found: {prompt_path}")

        # Read prompt
        try:
            content = prompt_path.read_text(encoding="utf-8")
        except Exception as e:
            raise ValueError(f"Failed to read prompt file: {e}")

        # Format with kwargs (safe formatting)
        if format_kwargs:
            content = self._safe_format(content, **format_kwargs)

        return content

    def _safe_format(self, template: str, **kwargs) -> str:
        """
        Safe string formatting that only replaces known placeholders.

        Uses {placeholder} syntax but doesn't fail on unmatched placeholders.
        """
        for key, value in kwargs.items():
            placeholder = "{" + key + "}"
            template = template.replace(placeholder, str(value))
        return template

    def load_optional(
        self,
        folder: str,
        filename: str,
        default: str = "",
        **format_kwargs,
    ) -> str:
        """
        Load a prompt file, returning default if not found.

        Args:
            folder: Prompt folder
            filename: Prompt filename
            default: Default value if file not found
            **format_kwargs: Variables to substitute

        Returns:
            Prompt string or default
        """
        try:
            return self.load(folder, filename, **format_kwargs)
        except ValueError:
            return default

    def exists(self, folder: str, filename: str) -> bool:
        """Check if a prompt file exists."""
        if folder not in VALID_FOLDERS:
            return False

        prompt_path = self.prompts_dir / folder / filename
        return prompt_path.is_file()

    def list_prompts(self, folder: str) -> list:
        """List all prompt files in a folder."""
        if folder not in VALID_FOLDERS:
            return []

        folder_path = self.prompts_dir / folder
        if not folder_path.is_dir():
            return []

        return [f.name for f in folder_path.iterdir() if f.is_file()]


# Global prompt loader instance
prompt_loader = PromptLoader()
