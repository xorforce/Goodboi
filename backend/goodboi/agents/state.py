"""Shared state definitions for the LangGraph agents."""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage


class FeatureRequestState(TypedDict):
    messages: Annotated[list, operator.add]
    file_content: str
    feature_summary: str
    is_complete: bool
    session_id: str
    model: str
    project_context: str


class PRDState(TypedDict):
    feature_summary: str
    prd_markdown: str
    session_id: str
    model: str
    project_context: str
    validation_template: str
    validation_feedback: str


class CodeState(TypedDict):
    feature_summary: str
    prd_markdown: str
    code_markdown: str
    session_id: str
    model: str
    project_context: str
    validation_template: str
    validation_feedback: str
