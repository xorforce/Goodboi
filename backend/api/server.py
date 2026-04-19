"""FastAPI server exposing the LangGraph agents."""

from __future__ import annotations

import os
import uuid
import traceback
from pathlib import Path
from typing import Optional

# Load .env FIRST, before any other imports that might read env vars
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Verify key is present at startup
_api_key = os.environ.get("OPENAI_API_KEY", "")
if not _api_key or _api_key.startswith("your-"):
    print(
        "\n\u26a0\ufe0f  WARNING: OPENAI_API_KEY is not set or still a placeholder in backend/.env\n"
    )

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..agents.orchestrator import chat, generate_prd, get_session_state

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
    model: Optional[str] = Field(default=None, description="OpenAI model ID")


class ChatResponse(BaseModel):
    reply: str
    is_complete: bool
    feature_summary: str


class PRDRequest(BaseModel):
    session_id: str
    model: Optional[str] = Field(default=None)


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
    try:
        result = await chat(req.session_id, req.message, model=req.model)
        return ChatResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"LLM call failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/chat/upload", response_model=ChatResponse)
async def chat_with_upload(
    session_id: str = Form(...),
    message: str = Form(...),
    file: UploadFile = File(...),
    model: Optional[str] = Form(default=None),
):
    """Send a message + file to the feature-request agent."""
    try:
        contents = await file.read()

        # Save file for reference
        file_path = UPLOAD_DIR / f"{session_id}_{file.filename}"
        file_path.write_bytes(contents)

        # Extract text content (supports .txt, .md, and common text files)
        try:
            file_text = contents.decode("utf-8")
        except UnicodeDecodeError:
            file_text = f"[Binary file uploaded: {file.filename}]"

        result = await chat(session_id, message, file_content=file_text, model=model)
        return ChatResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"LLM call failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/generate-prd", response_model=PRDResponse)
async def generate_prd_endpoint(req: PRDRequest):
    """Generate the PRD from the completed feature request."""
    try:
        result = await generate_prd(req.session_id, model=req.model)
        return PRDResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"PRD generation failed: {type(e).__name__}: {str(e)}"
            },
        )


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Retrieve current session state."""
    return get_session_state(session_id)


@app.get("/api/health")
async def health():
    has_key = bool(os.environ.get("OPENAI_API_KEY"))
    return {"status": "ok", "openai_key_set": has_key}
