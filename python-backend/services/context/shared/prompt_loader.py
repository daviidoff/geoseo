"""
Shared Prompt Loader for OpenContext.

Loads prompts from text files and handles placeholder substitution.
Enables prompt iteration without touching Python code.

Usage:
    from shared.prompt_loader import load_prompt

    # Load and format prompt
    prompt = load_prompt("opencontext", "opencontext", url="https://example.com")

    # Or load raw without formatting
    raw = load_prompt("opencontext", "opencontext", format=False)
"""

import logging
import re
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Project root
_ROOT = Path(__file__).parent.parent

# Valid folder names (whitelist for security)
_VALID_FOLDERS = {"opencontext", "shared"}


def _validate_path_component(name: str, component_type: str) -> str:
    """
    Validate a path component to prevent path traversal attacks.

    Args:
        name: The component name to validate
        component_type: Description for error messages (e.g., "folder", "prompt_name")

    Returns:
        The validated name

    Raises:
        ValueError: If the name contains path traversal characters
    """
    if not name or not isinstance(name, str):
        raise ValueError(f"Invalid {component_type}: must be a non-empty string")

    # Reject path traversal patterns
    if ".." in name or name.startswith("/") or name.startswith("\\"):
        raise ValueError(f"Invalid {component_type}: path traversal not allowed")

    # Reject any path separators
    if "/" in name or "\\" in name:
        raise ValueError(f"Invalid {component_type}: path separators not allowed")

    # Only allow alphanumeric, underscore, hyphen
    if not re.match(r'^[\w\-]+$', name):
        raise ValueError(f"Invalid {component_type}: contains invalid characters")

    return name


def load_prompt(
    folder: str,
    prompt_name: str,
    format: bool = True,
    **kwargs,
) -> str:
    """
    Load a prompt from a text file.

    Args:
        folder: Folder name (e.g., "opencontext")
        prompt_name: Prompt file name without extension (e.g., "opencontext")
        format: Whether to format placeholders with kwargs
        **kwargs: Placeholder values (e.g., url="...")

    Returns:
        Prompt string with placeholders replaced

    Raises:
        FileNotFoundError: If prompt file doesn't exist
        ValueError: If folder or prompt_name contains path traversal
    """
    # Validate inputs to prevent path traversal
    _validate_path_component(folder, "folder")
    _validate_path_component(prompt_name, "prompt_name")

    # Additional check: folder must be in whitelist
    if folder not in _VALID_FOLDERS:
        raise ValueError(f"Invalid folder: {folder}. Must be one of: {_VALID_FOLDERS}")

    # Build path to prompt file
    prompt_path = _ROOT / folder / "prompts" / f"{prompt_name}.txt"

    # Resolve to absolute path and verify it's within _ROOT
    resolved_path = prompt_path.resolve()
    resolved_root = _ROOT.resolve()
    if not str(resolved_path).startswith(str(resolved_root)):
        raise ValueError(f"Invalid path: access outside project root not allowed")

    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    # Read prompt
    prompt = prompt_path.read_text(encoding="utf-8")

    # Format placeholders if requested
    if format and kwargs:
        try:
            prompt = _safe_format(prompt, kwargs)
        except Exception as e:
            logger.warning(f"Failed to format prompt {prompt_name}: {e}")

    return prompt


def _safe_format(template: str, values: Dict[str, Any]) -> str:
    """
    Format template with values, leaving unknown placeholders intact.

    Handles both {key} and {{key}} (escaped) formats.
    """
    result = template

    for key, value in values.items():
        # Replace {key} with value
        placeholder = "{" + key + "}"
        result = result.replace(placeholder, str(value))

    return result


def get_prompt_path(folder: str, prompt_name: str) -> Path:
    """
    Get the path to a prompt file.

    Args:
        folder: Folder name
        prompt_name: Prompt file name without extension

    Returns:
        Path object to the prompt file

    Raises:
        ValueError: If folder or prompt_name contains path traversal
    """
    _validate_path_component(folder, "folder")
    _validate_path_component(prompt_name, "prompt_name")
    return _ROOT / folder / "prompts" / f"{prompt_name}.txt"


def prompt_exists(folder: str, prompt_name: str) -> bool:
    """
    Check if a prompt file exists.

    Args:
        folder: Folder name
        prompt_name: Prompt file name without extension

    Returns:
        True if file exists
    """
    try:
        return get_prompt_path(folder, prompt_name).exists()
    except ValueError:
        return False
