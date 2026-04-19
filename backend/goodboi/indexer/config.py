"""Manages the .goodboi/ directory and config.yaml for a project."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

import yaml


GOODBOI_DIR = ".goodboi"
CONFIG_FILE = "config.yaml"
CONTEXT_FILE = "context.json"


def get_agent_dir(project_root: Path) -> Path:
    return project_root / GOODBOI_DIR


def ensure_agent_dir(project_root: Path) -> Path:
    """Create the .goodboi/ directory if it doesn't exist."""
    agent_dir = get_agent_dir(project_root)
    agent_dir.mkdir(parents=True, exist_ok=True)
    (agent_dir / "sessions").mkdir(exist_ok=True)
    return agent_dir


def load_config(project_root: Path) -> Dict[str, Any]:
    """Load config.yaml from .goodboi/. Returns empty dict if missing."""
    config_path = get_agent_dir(project_root) / CONFIG_FILE
    if not config_path.exists():
        return {}
    with open(config_path, "r") as f:
        return yaml.safe_load(f) or {}


def save_config(project_root: Path, config: Dict[str, Any]):
    """Save config.yaml to .goodboi/."""
    agent_dir = ensure_agent_dir(project_root)
    config_path = agent_dir / CONFIG_FILE
    with open(config_path, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


def load_context(project_root: Path) -> Optional[Dict[str, Any]]:
    """Load cached project context from .goodboi/context.json."""
    context_path = get_agent_dir(project_root) / CONTEXT_FILE
    if not context_path.exists():
        return None
    try:
        with open(context_path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def save_context(project_root: Path, context: Dict[str, Any]):
    """Save project context to .goodboi/context.json."""
    agent_dir = ensure_agent_dir(project_root)
    context_path = agent_dir / CONTEXT_FILE
    with open(context_path, "w") as f:
        json.dump(context, f, indent=2)


def build_default_config(project_summary_yaml: str) -> Dict[str, Any]:
    """Build a default config.yaml from the project summary."""
    return {
        "version": "0.1.0",
        "project_summary": project_summary_yaml,
        "settings": {
            "default_model": "gpt-4o",
            "port": 8000,
        },
        "agents": {
            "feature_request": {
                "enabled": True,
            },
            "prd_writer": {
                "enabled": True,
            },
        },
        "validators": {
            "prd": {
                "enabled": True,
                "template": (
                    "Validate that the PRD is complete, actionable, grounded in the project context, "
                    "and includes clear functional requirements, technical considerations, risks, "
                    "and open questions. Reject vague or generic PRDs."
                ),
            },
            "code": {
                "enabled": True,
                "template": (
                    "Validate that the coding handoff is concrete, repository-specific, implementation-ready, "
                    "and names realistic files, interfaces, and test updates. Reject generic handoffs."
                ),
            },
            "review": {
                "enabled": True,
                "template": (
                    "Validate that the review report clearly explains what was reviewed, what was changed, "
                    "what risks remain, and whether the output is ready for human approval."
                ),
            },
        },
        "connections": [],
    }
