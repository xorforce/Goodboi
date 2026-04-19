"""Agent 2 -- PRD Writer.

Takes the structured feature summary from Agent 1 and produces a
professional Product Requirements Document in Markdown.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .state import PRDState

SYSTEM_PROMPT = """\
You are a world-class technical product manager.  Given a feature summary,
produce a comprehensive **Product Requirements Document (PRD)** in Markdown.

The PRD MUST include the following sections:

# {Feature Title}

## 1. Overview
Brief executive summary of the feature.

## 2. Problem Statement
What problem does this solve and why it matters now.

## 3. Goals & Success Metrics
Measurable outcomes that define success.

## 4. Target Users
Who benefits and their key characteristics.

## 5. User Stories
Concrete user stories in "As a [user], I want [goal] so that [benefit]" format.

## 6. Functional Requirements
Detailed must-have requirements (numbered).

## 7. Non-Functional Requirements
Performance, security, scalability, accessibility considerations.

## 8. Out of Scope
What is explicitly excluded from this version.

## 9. Design & UX Considerations
High-level UX guidance, wireframe descriptions if applicable.

## 10. Technical Considerations
Architecture notes, API changes, data model impacts.

## 11. Dependencies & Risks
External dependencies, potential risks with mitigations.

## 12. Release Criteria
Definition of done / launch checklist.

## 13. Open Questions
Unresolved items that need further discussion.

---

Guidelines:
- Be thorough but concise.
- Use bullet points and numbered lists liberally.
- Where the feature summary lacks detail, make reasonable assumptions and
  flag them in the Open Questions section.
- Output ONLY the Markdown PRD, no preamble.
"""


def _build_llm() -> ChatOpenAI:
    return ChatOpenAI(model="gpt-4o", temperature=0.2)


# ── Graph nodes ──────────────────────────────────────────────────────────


def write_prd(state: PRDState) -> dict:
    """Generate the full PRD from the feature summary."""
    llm = _build_llm()
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
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


# ── Build the graph ──────────────────────────────────────────────────────


def build_prd_writer_graph() -> StateGraph:
    graph = StateGraph(PRDState)
    graph.add_node("write_prd", write_prd)
    graph.set_entry_point("write_prd")
    graph.add_edge("write_prd", END)
    return graph.compile()
