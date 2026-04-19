"""Project context manager.

Loads cached project context and builds system prompt fragments
that can be injected into any agent.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Optional

from .indexer.config import load_context, load_config


_cached_context: Optional[Dict] = None
_cached_config: Optional[Dict] = None


def _get_project_root() -> Optional[Path]:
    raw = os.environ.get("GOODBOI_PROJECT_ROOT")
    return Path(raw) if raw else None


def get_project_context() -> Optional[Dict]:
    """Load and cache the project context."""
    global _cached_context
    if _cached_context is not None:
        return _cached_context

    root = _get_project_root()
    if not root:
        return None

    _cached_context = load_context(root)
    return _cached_context


def get_project_config() -> Optional[Dict]:
    """Load and cache the project config."""
    global _cached_config
    if _cached_config is not None:
        return _cached_config

    root = _get_project_root()
    if not root:
        return None

    _cached_config = load_config(root)
    return _cached_config


def reload_context():
    """Force reload context from disk (after a refresh)."""
    global _cached_context, _cached_config
    _cached_context = None
    _cached_config = None
    get_project_context()
    get_project_config()


def get_validator_template(stage: str) -> str:
    """Return the configured validator template for a stage."""
    config = get_project_config() or {}
    validators = config.get("validators") or {}
    stage_config = validators.get(stage) or {}
    if not stage_config.get("enabled", True):
        return ""
    return stage_config.get("template", "")


def build_context_prompt() -> str:
    """Build the project context block to inject into agent system prompts.

    Returns an empty string if no context is available (graceful degradation).
    """
    ctx = get_project_context()
    if not ctx:
        return ""

    parts = []

    parts.append("<project_context>")

    # Project summary
    summary = ctx.get("project_summary", "")
    if summary:
        parts.append(f"## Project Summary\n{summary}")

    # File tree (truncated)
    tree = ctx.get("file_tree", "")
    if tree:
        lines = tree.split("\n")[:40]
        tree_str = "\n".join(lines)
        if len(tree.split("\n")) > 40:
            tree_str += "\n... (truncated)"
        parts.append(f"## File Structure\n```\n{tree_str}\n```")

    # Key code summaries
    code_summaries = ctx.get("code_summaries", {})
    if code_summaries:
        lines = [f"- **{p}**: {s}" for p, s in list(code_summaries.items())[:15]]
        parts.append("## Key Source Files\n" + "\n".join(lines))

    # Doc excerpts (just names + first paragraph)
    doc_contents = ctx.get("doc_contents", {})
    if doc_contents:
        doc_lines = []
        for path, content in list(doc_contents.items())[:5]:
            excerpt = content[:500].strip()
            if len(content) > 500:
                excerpt += "..."
            doc_lines.append(f"### {path}\n{excerpt}")
        parts.append("## Documentation Excerpts\n" + "\n\n".join(doc_lines))

    parts.append("</project_context>")

    return "\n\n".join(parts)
