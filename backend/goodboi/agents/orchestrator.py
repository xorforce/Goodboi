"""Top-level orchestrator that manages the two-agent pipeline.

This version accepts project_context to inject into agent prompts.
"""

from __future__ import annotations

from typing import Optional

from langchain_core.messages import HumanMessage

from .coding_agent import build_coding_graph
from .feature_request_agent import build_feature_request_graph
from .prd_writer_agent import build_prd_writer_graph
from .stage_validator_agent import validate_stage_output
from ..context import get_validator_template

# Compile the graphs once at module level
feature_request_graph = build_feature_request_graph()
prd_writer_graph = build_prd_writer_graph()
coding_graph = build_coding_graph()


# ── In-memory session store ──────────────────────────────────────────────

_sessions: dict = {}


def _get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "messages": [],
            "file_content": "",
            "feature_summary": "",
            "prd_markdown": "",
            "code_markdown": "",
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
    project_context: Optional[str] = None,
) -> dict:
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
        "project_context": project_context or "",
    }

    result = feature_request_graph.invoke(state)

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
    session_id: str,
    model: Optional[str] = None,
    project_context: Optional[str] = None,
) -> dict:
    session = _get_session(session_id)

    if not session["feature_summary"]:
        return {
            "prd_markdown": "Error: No feature summary available. Complete the feature request conversation first."
        }

    validation_template = get_validator_template("prd")
    validation_feedback = ""

    for _ in range(3):
        state = {
            "feature_summary": session["feature_summary"],
            "prd_markdown": "",
            "session_id": session_id,
            "model": model or "",
            "project_context": project_context or "",
            "validation_template": validation_template,
            "validation_feedback": validation_feedback,
        }

        result = prd_writer_graph.invoke(state)
        validation = validate_stage_output(
            stage="prd",
            artifact=result["prd_markdown"],
            validator_template=validation_template,
            project_context=project_context or "",
            model=model,
        )
        session["prd_validation"] = validation
        if validation.get("valid", True):
            session["prd_markdown"] = result["prd_markdown"]
            break
        validation_feedback = validation.get("feedback", "")
    else:
        session["prd_markdown"] = result["prd_markdown"]

    return {"prd_markdown": session["prd_markdown"]}


async def generate_code(
    session_id: str,
    model: Optional[str] = None,
    project_context: Optional[str] = None,
) -> dict:
    session = _get_session(session_id)

    if not session["prd_markdown"]:
        return {
            "code_markdown": "Error: No PRD available. Generate the PRD before handing off to the coding agent."
        }

    validation_template = get_validator_template("code")
    validation_feedback = ""

    for _ in range(3):
        state = {
            "feature_summary": session.get("feature_summary", ""),
            "prd_markdown": session["prd_markdown"],
            "code_markdown": "",
            "session_id": session_id,
            "model": model or "",
            "project_context": project_context or "",
            "validation_template": validation_template,
            "validation_feedback": validation_feedback,
        }

        result = coding_graph.invoke(state)
        validation = validate_stage_output(
            stage="code",
            artifact=result["code_markdown"],
            validator_template=validation_template,
            project_context=project_context or "",
            model=model,
        )
        session["code_validation"] = validation
        if validation.get("valid", True):
            session["code_markdown"] = result["code_markdown"]
            break
        validation_feedback = validation.get("feedback", "")
    else:
        session["code_markdown"] = result["code_markdown"]

    return {"code_markdown": session["code_markdown"]}


def get_session_state(session_id: str) -> dict:
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
        "prd_markdown": session.get("prd_markdown", ""),
        "code_markdown": session.get("code_markdown", ""),
        "prd_validation": session.get("prd_validation", {}),
        "code_validation": session.get("code_validation", {}),
        "is_complete": session["is_complete"],
    }
