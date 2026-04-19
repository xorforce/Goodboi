"""FastAPI server exposing the LangGraph agents."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from ..agents.orchestrator import chat, generate_prd, get_session_state  # noqa: E402

app = FastAPI(title="PRD Generator", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Request / Response models ────────────────────────────────────────────


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    is_complete: bool
    feature_summary: str


class PRDResponse(BaseModel):
    prd_markdown: str


class SessionResponse(BaseModel):
    session_id: str


# ── Endpoints ────────────────────────────────────────────────────────────


@app.post("/api/session", response_model=SessionResponse)
async def create_session():
    """Create a new session and return its ID."""
    return SessionResponse(session_id=str(uuid.uuid4()))


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """Send a message to the feature-request agent."""
    result = await chat(req.session_id, req.message)
    return ChatResponse(**result)


@app.post("/api/chat/upload", response_model=ChatResponse)
async def chat_with_upload(
    session_id: str = Form(...),
    message: str = Form(...),
    file: UploadFile = File(...),
):
    """Send a message + file to the feature-request agent."""
    contents = await file.read()

    # Save file for reference
    file_path = UPLOAD_DIR / f"{session_id}_{file.filename}"
    file_path.write_bytes(contents)

    # Extract text content (supports .txt, .md, and common text files)
    try:
        file_text = contents.decode("utf-8")
    except UnicodeDecodeError:
        file_text = f"[Binary file uploaded: {file.filename}]"

    result = await chat(session_id, message, file_content=file_text)
    return ChatResponse(**result)


@app.post("/api/generate-prd", response_model=PRDResponse)
async def generate_prd_endpoint(req: ChatRequest):
    """Generate the PRD from the completed feature request."""
    result = await generate_prd(req.session_id)
    return PRDResponse(**result)


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Retrieve current session state."""
    return get_session_state(session_id)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
