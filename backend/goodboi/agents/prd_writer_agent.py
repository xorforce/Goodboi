"""Agent 2 -- PRD Writer (project-aware)."""

from __future__ import annotations

from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .state import PRDState

SYSTEM_PROMPT = """\
You are a world-class technical product manager.  Given a feature summary,
produce a comprehensive **Product Requirements Document (PRD)** in Markdown.

The PRD MUST include the following sections:

# {{Feature Title}}

## 1. Overview
## 2. Problem Statement
## 3. Goals & Success Metrics
## 4. Target Users
## 5. User Stories
## 6. Functional Requirements
## 7. Non-Functional Requirements
## 8. Out of Scope
## 9. Design & UX Considerations
## 10. Technical Considerations
## 11. Dependencies & Risks
## 12. Release Criteria
## 13. Open Questions

Guidelines:
- Be thorough but concise.
- Use bullet points and numbered lists liberally.
- If project context is available, reference the actual tech stack,
  architecture, and conventions when writing Technical Considerations.
- Where the feature summary lacks detail, make reasonable assumptions and
  flag them in the Open Questions section.
- Output ONLY the Markdown PRD, no preamble.
"""

DEFAULT_MODEL = "gpt-4o"


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or DEFAULT_MODEL,
        temperature=0.2,
        streaming=False,
    )


def write_prd(state: PRDState) -> dict:
    model = state.get("model") or None
    llm = _build_llm(model)

    system_parts = [SYSTEM_PROMPT]

    project_context = state.get("project_context", "")
    if project_context:
        system_parts.append(
            "\n\nThe following is context about the project this PRD is for. "
            "Use it to write technically grounded requirements:\n\n"
            + project_context
        )

    validation_template = state.get("validation_template", "")
    if validation_template:
        system_parts.append(
            "\n\nThe generated PRD will be validated against this template. Satisfy it in the first draft:\n\n"
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
                "Here is the confirmed feature summary. "
                "Write the PRD now.\n\n"
                f"{state['feature_summary']}"
            )
        ),
    ]
    response = llm.invoke(messages)
    return {"prd_markdown": response.content}


def build_prd_writer_graph() -> StateGraph:
    graph = StateGraph(PRDState)
    graph.add_node("write_prd", write_prd)
    graph.set_entry_point("write_prd")
    graph.add_edge("write_prd", END)
    return graph.compile()
