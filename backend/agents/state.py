"""Shared state definitions for the LangGraph agents."""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage


class FeatureRequestState(TypedDict):
    """State for the conversational feature-request agent."""

    messages: Annotated[list[BaseMessage], operator.add]
    file_content: str  # extracted text from uploaded file (if any)
    feature_summary: str  # structured summary built through conversation
    is_complete: bool  # True when user confirms the feature request is ready
    session_id: str


class PRDState(TypedDict):
    """State for the PRD-writer agent."""

    feature_summary: str  # input from agent 1
    prd_markdown: str  # generated PRD output
    session_id: str
