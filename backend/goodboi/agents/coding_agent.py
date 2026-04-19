"""Agent 3 -- Coding Agent (project-aware, frontier-model oriented)."""

from __future__ import annotations

import json
import re
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .state import CodeState

SYSTEM_PROMPT = """\
You are a senior staff engineer. Given a confirmed PRD and project context,
produce an implementation handoff for a coding agent using a frontier model.

Output a Markdown document with these sections:

# Implementation Handoff

## 1. Delivery Summary
Briefly describe what needs to be built.

## 2. Architecture Fit
Explain how the feature should fit into the existing codebase and conventions.

## 3. Files To Create Or Update
- List concrete files, grouped by area.
- If exact file paths are uncertain, propose likely paths and say why.

## 4. Step-By-Step Implementation Plan
Numbered, execution-ready steps for the coding agent.

## 5. Key Interfaces And Data Contracts
APIs, types, schemas, payloads, state shape, component props, etc.

## 6. Code Skeletons
Provide concise starter code blocks for the highest-risk or most important pieces.

## 7. Tests
List the tests to add or update.

## 8. Risks And Edge Cases
Call out likely implementation pitfalls.

## 9. Suggested Frontier Model
Recommend one of: `gpt-4.1`, `o3`, or `gpt-4o`, with a one-line reason.

Guidelines:
- Ground the output in the provided project context.
- Prefer concrete file paths and actionable steps over generic advice.
- Do not invent large subsystems that don't fit the existing architecture.
- Output ONLY Markdown.
"""

DEFAULT_MODEL = "gpt-4.1"

PATCH_PLAN_PROMPT = """\
You are a senior software engineer applying a feature to a real repository.

Generate a JSON object describing the concrete repository changes to make.
Return ONLY JSON. Do not use markdown fences.

Schema:
{
  "branch_name": "goodboi/<short-kebab-name>",
  "commit_message": "imperative git commit message",
  "summary": "one short sentence",
  "files": [
    {
      "path": "relative/path/to/file",
      "action": "create" | "update",
      "content": "full file contents"
    }
  ]
}

Rules:
- Only emit create/update actions. Never delete files.
- Use the provided repository files as the source of truth for updates.
- For updates, return the FULL updated file content.
- Keep the change set minimal and coherent.
- Prefer existing patterns, libraries, and architecture.
- If you need a new file, place it in the most likely directory based on the repo structure.
- Branch names must be short and git-safe.
- Commit messages must be concise and reflect why the change exists.
"""


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or DEFAULT_MODEL,
        temperature=0.1,
        streaming=False,
    )


def write_code_handoff(state: CodeState) -> dict:
    model = state.get("model") or None
    llm = _build_llm(model)

    system_parts = [SYSTEM_PROMPT]
    project_context = state.get("project_context", "")
    if project_context:
        system_parts.append(
            "\n\nUse the following project context to make the implementation handoff specific "
            "to the current codebase:\n\n" + project_context
        )

    validation_template = state.get("validation_template", "")
    if validation_template:
        system_parts.append(
            "\n\nThe generated handoff will be validated against this template. Satisfy it directly:\n\n"
            + validation_template
        )

    validation_feedback = state.get("validation_feedback", "")
    if validation_feedback:
        system_parts.append(
            "\n\nPrevious draft validation feedback to fix in this regeneration:\n\n"
            + validation_feedback
        )

    messages = [
        SystemMessage(content="\n".join(system_parts)),
        HumanMessage(
            content=(
                "Feature summary:\n\n"
                f"{state['feature_summary']}\n\n"
                "Confirmed PRD:\n\n"
                f"{state['prd_markdown']}"
            )
        ),
    ]
    response = llm.invoke(messages)
    return {"code_markdown": response.content}


def build_coding_graph() -> StateGraph:
    graph = StateGraph(CodeState)
    graph.add_node("write_code_handoff", write_code_handoff)
    graph.set_entry_point("write_code_handoff")
    graph.add_edge("write_code_handoff", END)
    return graph.compile()


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def generate_repo_change_plan(
    *,
    feature_summary: str,
    prd_markdown: str,
    project_context: str,
    repo_files_context: str,
    model: Optional[str] = None,
) -> dict:
    llm = _build_llm(model)
    messages = [
        SystemMessage(content=PATCH_PLAN_PROMPT),
        HumanMessage(
            content=(
                "Project context:\n\n"
                f"{project_context}\n\n"
                "Relevant repository files:\n\n"
                f"{repo_files_context}\n\n"
                "Feature summary:\n\n"
                f"{feature_summary}\n\n"
                "Confirmed PRD:\n\n"
                f"{prd_markdown}"
            )
        ),
    ]
    response = llm.invoke(messages)
    return _extract_json_object(response.content)
