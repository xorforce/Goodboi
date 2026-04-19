"""Shared validator agent for PRD, Code, and Review stages."""

from __future__ import annotations

import json
import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

DEFAULT_MODEL = "gpt-4.1-mini"

VALIDATOR_PROMPT = """\
You are a strict stage validator. Review the generated artifact against the provided
validation template and project context.

Return ONLY JSON with this schema:
{
  "valid": true | false,
  "feedback": "short actionable feedback",
  "issues": ["issue 1", "issue 2"]
}

Rules:
- Set `valid` to true only if the artifact clearly satisfies the template.
- If invalid, give concrete feedback that can be used to regenerate it.
- Keep feedback short, specific, and actionable.
"""


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(model=model or DEFAULT_MODEL, temperature=0, streaming=False)


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def validate_stage_output(
    *,
    stage: str,
    artifact: str,
    validator_template: str,
    project_context: str,
    model: Optional[str] = None,
) -> dict:
    if not validator_template.strip():
        return {"valid": True, "feedback": "", "issues": []}

    llm = _build_llm(model)
    messages = [
        SystemMessage(content=VALIDATOR_PROMPT),
        HumanMessage(
            content=(
                f"Stage: {stage}\n\n"
                "Validator template:\n\n"
                f"{validator_template}\n\n"
                "Project context:\n\n"
                f"{project_context}\n\n"
                "Artifact:\n\n"
                f"{artifact}"
            )
        ),
    ]
    response = llm.invoke(messages)
    return _extract_json_object(response.content)
