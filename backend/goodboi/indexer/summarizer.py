"""Summarizes project files using an LLM to build compact project context.

Reads docs, manifests, and key source files, then produces a structured
project summary that agents can use in their system prompts.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from .scanner import ProjectScan, FileInfo

# Maximum characters to read from a single file before truncating
MAX_FILE_CHARS = 8000

# Maximum source files to summarize (by importance heuristic)
MAX_CODE_FILES_TO_SUMMARIZE = 20


SUMMARIZE_SYSTEM_PROMPT = """\
You are a senior software architect. Given the contents of files from a
software project, produce a structured project summary in YAML format.

Output ONLY the YAML, no preamble or explanation.

The YAML must have these keys:
  name: <project name>
  description: <one-paragraph description of what this project does>
  tech_stack:
    languages: [list]
    frameworks: [list]
    databases: [list if any]
    infra: [list if any]
  architecture: <brief description of the architecture pattern>
  key_directories:
    - path: <relative path>
      purpose: <what it contains>
  conventions:
    - <coding convention or pattern observed>
  entry_points:
    - <main entry point files>
  existing_docs_summary: <summary of any existing documentation>
"""

CODE_SUMMARY_PROMPT = """\
You are a senior developer. Summarize this source file in 2-3 sentences.
Focus on: what it does, key exports/classes, and how it fits in the project.

File: {path}
```
{content}
```

Summary:
"""


def _read_file_safe(path: Path, max_chars: int = MAX_FILE_CHARS) -> str:
    """Read a file, truncating if needed. Returns empty string on error."""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n... [truncated]"
        return text
    except Exception:
        return ""


def _pick_important_code_files(scan: ProjectScan) -> List[FileInfo]:
    """Heuristically pick the most important source files to summarize."""
    code = scan.code_files

    # Score files by importance signals
    scored = []
    for f in code:
        score = 0
        name_lower = f.name.lower()

        # Entry points
        if name_lower in ("main.py", "app.py", "index.ts", "index.js", "main.go", "main.rs"):
            score += 10
        if "route" in name_lower or "api" in name_lower:
            score += 5
        if "model" in name_lower or "schema" in name_lower:
            score += 5
        if "config" in name_lower or "settings" in name_lower:
            score += 4
        if "middleware" in name_lower or "auth" in name_lower:
            score += 3

        # Shallow files are usually more important
        depth = len(f.relative_path.parts)
        score += max(0, 5 - depth)

        # Reasonable size files (not too tiny, not too huge)
        if 200 < f.size_bytes < 50000:
            score += 2

        scored.append((score, f))

    scored.sort(key=lambda x: -x[0])
    return [f for _, f in scored[:MAX_CODE_FILES_TO_SUMMARIZE]]


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or "gpt-4o-mini",  # Use mini for indexing to save cost
        temperature=0,
    )


def build_project_context(
    scan: ProjectScan,
    model: Optional[str] = None,
) -> Dict:
    """Build a full project context dictionary from a scan.

    Returns a dict with:
        project_summary: str  -- YAML summary of the project
        file_tree: str        -- visual tree string
        doc_contents: dict    -- {relative_path: content}
        code_summaries: dict  -- {relative_path: summary}
        manifest_contents: dict -- {relative_path: content}
    """
    llm = _build_llm(model)

    # 1. Read all docs and manifests
    doc_contents = {}
    for f in scan.docs:
        content = _read_file_safe(f.absolute_path)
        if content.strip():
            doc_contents[str(f.relative_path)] = content

    manifest_contents = {}
    for f in scan.manifests:
        content = _read_file_safe(f.absolute_path, max_chars=4000)
        if content.strip():
            manifest_contents[str(f.relative_path)] = content

    config_contents = {}
    for f in scan.configs:
        content = _read_file_safe(f.absolute_path, max_chars=2000)
        if content.strip():
            config_contents[str(f.relative_path)] = content

    # 2. Summarize key code files
    important_files = _pick_important_code_files(scan)
    code_summaries = {}

    for f in important_files:
        content = _read_file_safe(f.absolute_path)
        if not content.strip():
            continue

        try:
            resp = llm.invoke([
                HumanMessage(content=CODE_SUMMARY_PROMPT.format(
                    path=str(f.relative_path),
                    content=content,
                ))
            ])
            code_summaries[str(f.relative_path)] = resp.content.strip()
        except Exception:
            code_summaries[str(f.relative_path)] = "[summary failed]"

    # 3. Build the overall project summary
    summary_input_parts = [
        f"## File Tree\n```\n{scan.tree_string}\n```",
    ]

    if manifest_contents:
        for path, content in list(manifest_contents.items())[:3]:
            summary_input_parts.append(f"## {path}\n```\n{content}\n```")

    if doc_contents:
        for path, content in list(doc_contents.items())[:3]:
            summary_input_parts.append(
                f"## {path}\n```\n{content[:3000]}\n```"
            )

    if code_summaries:
        lines = [f"- **{p}**: {s}" for p, s in code_summaries.items()]
        summary_input_parts.append(
            "## Code File Summaries\n" + "\n".join(lines)
        )

    try:
        resp = llm.invoke([
            SystemMessage(content=SUMMARIZE_SYSTEM_PROMPT),
            HumanMessage(content="\n\n".join(summary_input_parts)),
        ])
        project_summary = resp.content.strip()
    except Exception as e:
        project_summary = f"name: unknown\ndescription: Failed to generate summary ({e})"

    return {
        "project_summary": project_summary,
        "file_tree": scan.tree_string,
        "doc_contents": doc_contents,
        "code_summaries": code_summaries,
        "manifest_contents": manifest_contents,
        "config_contents": config_contents,
    }
