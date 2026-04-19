"""Top-level orchestrator that manages the two-agent pipeline.

Flow:
  1. User interacts with Agent 1 (feature request builder) over multiple turns.
  2. Once Agent 1 marks the request as complete, the orchestrator invokes
     Agent 2 (PRD writer) with the collected feature summary.
"""

from __future__ import annotations

from typing import Optional

from langchain_core.messages import HumanMessage

from .feature_request_agent import build_feature_request_graph
from .prd_writer_agent import build_prd_writer_graph

# Compile the graphs once at module level
feature_request_graph = build_feature_request_graph()
prd_writer_graph = build_prd_writer_graph()


# ── In-memory session store (swap for Redis/DB in production) ────────────

_sessions: dict = {}


def _get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "messages": [],
            "file_content": "",
            "feature_summary": "",
            "is_complete": False,
            "session_id": session_id,
        }
    return _sessions[session_id]


# ── Public API ───────────────────────────────────────────────────────────


async def chat(
    session_id: str,
    user_message: str,
    file_content: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    """Send a user message to Agent 1 and return the assistant reply.

    Returns
    -------
    dict with keys:
        reply: str          -- assistant message text
        is_complete: bool    -- whether the feature request is finalised
        feature_summary: str -- the latest structured summary (may be empty)
    """
    session = _get_session(session_id)

    if file_content and not session["file_content"]:
        session["file_content"] = file_content

    session["messages"].append(HumanMessage(content=user_message))

    state = {
        "messages": session["messages"],
        "file_content": session["file_content"],
        "feature_summary": session.get("feature_summary", ""),
        "is_complete": False,
        "session_id": session_id,
        "model": model or "",
    }

    result = feature_request_graph.invoke(state)

    # The graph appends only the new AI message; grab the last one.
    new_messages = result["messages"][len(session["messages"]):]
    session["messages"].extend(new_messages)
    session["feature_summary"] = result.get(
        "feature_summary", session["feature_summary"]
    )
    session["is_complete"] = result.get("is_complete", False)

    reply_text = new_messages[-1].content if new_messages else ""

    return {
        "reply": reply_text,
        "is_complete": session["is_complete"],
        "feature_summary": session["feature_summary"],
    }


async def generate_prd(
    session_id: str, model: Optional[str] = None
) -> dict:
    """Invoke Agent 2 to write the PRD from the finalised feature summary.

    Returns
    -------
    dict with key:
        prd_markdown: str -- the full PRD in Markdown
    """
    session = _get_session(session_id)

    if not session["feature_summary"]:
        return {
            "prd_markdown": "Error: No feature summary available. Complete the feature request conversation first."
        }

    state = {
        "feature_summary": session["feature_summary"],
        "prd_markdown": "",
        "session_id": session_id,
        "model": model or "",
    }

    result = prd_writer_graph.invoke(state)

    return {"prd_markdown": result["prd_markdown"]}


def get_session_state(session_id: str) -> dict:
    """Return the current state of a session (for the frontend)."""
    session = _get_session(session_id)
    messages_serialized = []
    for msg in session["messages"]:
        messages_serialized.append(
            {
                "role": "user" if isinstance(msg, HumanMessage) else "assistant",
                "content": msg.content,
            }
        )
    return {
        "messages": messages_serialized,
        "feature_summary": session["feature_summary"],
        "is_complete": session["is_complete"],
    }
