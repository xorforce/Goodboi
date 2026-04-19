"""Agent 1 -- Conversational Feature Request Builder.

This agent converses with the user to iteratively build a well-structured
feature request.  It asks clarifying questions about the problem, users,
scope, acceptance criteria, etc. until the request is solid enough to hand
off to the PRD writer.
"""

from __future__ import annotations

from typing import Optional

from langchain_core.messages import AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .state import FeatureRequestState

SYSTEM_PROMPT = """\
You are a senior product manager AI assistant.  Your job is to help the user
turn a rough idea into a clear, well-structured **feature request** that can
later be expanded into a full PRD.

Through conversation you should gather:
1. **Problem Statement** -- What problem does this feature solve?
2. **Target Users** -- Who benefits?
3. **Proposed Solution** -- High-level description of the feature.
4. **Key Requirements** -- Must-have behaviours / acceptance criteria.
5. **Out of Scope** -- What this feature explicitly does NOT cover.
6. **Success Metrics** -- How will we know this feature is successful?

Guidelines:
- Ask ONE focused question at a time.
- If the user uploaded a file, reference its contents to ask smarter questions.
- When you believe you have enough information, produce a structured summary
  wrapped in <feature_summary>...</feature_summary> XML tags and ask the user
  to confirm or request changes.
- After the user confirms, respond with exactly: **[FEATURE_REQUEST_COMPLETE]**
  so the system knows to move to PRD generation.
- Keep your tone professional but friendly.
"""

DEFAULT_MODEL = "gpt-4o"


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or DEFAULT_MODEL,
        temperature=0.3,
        streaming=False,
    )


# ── Graph nodes ──────────────────────────────────────────────────────────


def converse(state: FeatureRequestState) -> dict:
    """Main conversation node -- generates the next assistant reply."""
    model = state.get("model") or None
    llm = _build_llm(model)

    system_parts = [SYSTEM_PROMPT]
    if state.get("file_content"):
        system_parts.append(
            f"\n\nThe user uploaded a file with the following content:\n"
            f"<uploaded_file>\n{state['file_content']}\n</uploaded_file>"
        )

    messages = [SystemMessage(content="\n".join(system_parts))] + state["messages"]
    response = llm.invoke(messages)

    # Detect completion marker
    is_complete = "[FEATURE_REQUEST_COMPLETE]" in response.content

    # Extract feature summary if present
    feature_summary = state.get("feature_summary", "")
    if "<feature_summary>" in response.content:
        start = response.content.index("<feature_summary>") + len("<feature_summary>")
        end = response.content.index("</feature_summary>")
        feature_summary = response.content[start:end].strip()

    return {
        "messages": [response],
        "is_complete": is_complete,
        "feature_summary": feature_summary,
    }


def route_after_converse(state: FeatureRequestState) -> str:
    """Route to END after every reply -- the frontend drives the next turn."""
    return END


# ── Build the graph ──────────────────────────────────────────────────────


def build_feature_request_graph() -> StateGraph:
    graph = StateGraph(FeatureRequestState)
    graph.add_node("converse", converse)
    graph.set_entry_point("converse")
    graph.add_conditional_edges("converse", route_after_converse, {END: END})
    return graph.compile()
