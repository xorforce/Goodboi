"""Agent 4 -- Code Reviewer/Fixer."""

from __future__ import annotations

import json
import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

DEFAULT_MODEL = "gpt-4.1"

SYSTEM_PROMPT = """\
You are a senior code reviewer and fixer. You are given a feature summary, PRD,
project context, current changed files, git diff, and build output.

Your job:
1. Review the changed code critically.
2. Fix issues you find by returning updated full file contents where needed.
3. Return a concise review report.

Return ONLY JSON with this schema:
{
  "review_markdown": "markdown report",
  "reviewed_changes": ["what was reviewed", "..."],
  "fixes_applied": ["what the reviewer changed", "..."],
  "files": [
    {
      "path": "relative/path",
      "action": "update" | "create",
      "content": "full file contents"
    }
  ]
}

Rules:
- Only propose minimal, high-confidence fixes.
- Prefer fixing correctness, integration, and build issues over style nits.
- If no fixes are needed, return an empty `files` array and empty `fixes_applied`.
- `review_markdown` should include: Summary, Issues Found, Fixes Applied, Residual Risks.
"""


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(model=model or DEFAULT_MODEL, temperature=0.1, streaming=False)


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def review_and_fix_changes(
    *,
    feature_summary: str,
    prd_markdown: str,
    project_context: str,
    changed_files_context: str,
    diff_markdown: str,
    build_output: str,
    validation_template: str = "",
    validation_feedback: str = "",
    model: Optional[str] = None,
) -> dict:
    llm = _build_llm(model)
    system_parts = [SYSTEM_PROMPT]
    if validation_template:
        system_parts.append(
            "\n\nThe reviewer output will be validated against this template. Satisfy it directly:\n\n"
            + validation_template
        )
    if validation_feedback:
        system_parts.append(
            "\n\nPrevious validation feedback to fix in this regeneration:\n\n"
            + validation_feedback
        )
    messages = [
        SystemMessage(content="\n".join(system_parts)),
        HumanMessage(
            content=(
                "Project context:\n\n"
                f"{project_context}\n\n"
                "Feature summary:\n\n"
                f"{feature_summary}\n\n"
                "PRD:\n\n"
                f"{prd_markdown}\n\n"
                "Changed files:\n\n"
                f"{changed_files_context}\n\n"
                "Git diff:\n\n"
                f"{diff_markdown}\n\n"
                "Build output:\n\n"
                f"{build_output}"
            )
        ),
    ]
    response = llm.invoke(messages)
    return _extract_json_object(response.content)
