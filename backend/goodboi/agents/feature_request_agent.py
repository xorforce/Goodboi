"""Agent 1 -- Conversational Feature Request Builder (project-aware)."""

from __future__ import annotations

from typing import Optional

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .state import FeatureRequestState

SYSTEM_PROMPT = """\
You are a senior product manager AI assistant. Your job is to quickly turn a
rough user request into a clear **feature intent** that can be handed off to a PRD.

Your goal is NOT to run a long discovery interview.

Capture only the essentials:
1. **Intent** -- what the user wants built or changed
2. **Context** -- any key constraints, target area, or relevant files/screens
3. **Expected outcome** -- what success looks like at a high level

Guidelines:
- Default to summarizing quickly.
- Ask at most 1 brief follow-up question if the request is too ambiguous to act on.
- If the request is already clear enough, do NOT ask more questions.
- If the user uploaded a file, use it to infer missing context instead of asking more.
- Use the project context (if provided) to ground the summary in the actual codebase.
- As soon as you have enough information, produce a concise structured summary
  wrapped in <feature_summary>...</feature_summary> XML tags and ask for confirmation.
- Do not ask about out-of-scope items, metrics, release criteria, or deep product strategy
  unless the user explicitly brings them up.
- After the user confirms, respond with exactly: **[FEATURE_REQUEST_COMPLETE]**
  so the system knows to move to PRD generation.
- Keep replies short and practical.
"""

DEFAULT_MODEL = "gpt-4o"


def _build_llm(model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or DEFAULT_MODEL,
        temperature=0.3,
        streaming=False,
    )


def converse(state: FeatureRequestState) -> dict:
    model = state.get("model") or None
    llm = _build_llm(model)

    system_parts = [SYSTEM_PROMPT]

    # Inject project context
    project_context = state.get("project_context", "")
    if project_context:
        system_parts.append(
            "\n\nYou have access to the following context about the project "
            "you are building features for. Use it to ask informed questions "
            "and make relevant suggestions:\n\n" + project_context
        )

    if state.get("file_content"):
        system_parts.append(
            f"\n\nThe user uploaded a file with the following content:\n"
            f"<uploaded_file>\n{state['file_content']}\n</uploaded_file>"
        )

    messages = [SystemMessage(content="\n".join(system_parts))] + state["messages"]
    response = llm.invoke(messages)

    is_complete = "[FEATURE_REQUEST_COMPLETE]" in response.content

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
    return END


def build_feature_request_graph() -> StateGraph:
    graph = StateGraph(FeatureRequestState)
    graph.add_node("converse", converse)
    graph.set_entry_point("converse")
    graph.add_conditional_edges("converse", route_after_converse, {END: END})
    return graph.compile()
