"""Unified FastAPI server: API endpoints + static frontend.

This is the server that `goodboi start` runs.
It loads project context and injects it into agent prompts.
"""

from __future__ import annotations

import json
import os
import uuid
import traceback
from pathlib import Path
from typing import Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from dotenv import load_dotenv

# Load .env from project root if available, or from cwd as fallback
_project_root = os.environ.get("GOODBOI_PROJECT_ROOT", "")
if _project_root:
    load_dotenv(Path(_project_root) / ".env")
load_dotenv()  # also try cwd/.env as fallback

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .context import get_project_context, get_project_config, build_context_prompt, reload_context
from .agents.orchestrator import chat, generate_code, generate_prd, get_session_state
from .repo_service import (
    confirm_code_implementation,
    get_github_auth_status,
    prepare_code_implementation,
)

app = FastAPI(title="goodboi", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ────────────────────────────────────────────


class ChatRequest(BaseModel):
    session_id: str
    message: str
    model: Optional[str] = Field(default=None)


class ChatResponse(BaseModel):
    reply: str
    is_complete: bool
    feature_summary: str


class PRDRequest(BaseModel):
    session_id: str
    model: Optional[str] = Field(default=None)


class PRDResponse(BaseModel):
    prd_markdown: str


class CodeRequest(BaseModel):
    session_id: str
    model: Optional[str] = Field(default=None)


class CodeResponse(BaseModel):
    code_markdown: str


class GitHubConnectionRequest(BaseModel):
    token: str = ""
    owner: str = ""
    repo: str = ""
    branch: str = "main"


class ImplementCodeRequest(BaseModel):
    session_id: str
    model: Optional[str] = Field(default=None)
    github_connection: Optional[GitHubConnectionRequest] = Field(default=None)


class ImplementCodeResponse(BaseModel):
    summary: str
    branch_name: str
    commit_message: str
    changed_files: list[str]
    stash_message: str = ""
    diff_markdown: str = ""
    review_markdown: str = ""
    reviewed_changes: list[str] = []
    fixes_applied: list[str] = []
    build_command: str = ""
    build_output: str = ""
    build_succeeded: bool
    build_checked: bool
    pushed: bool = False
    pr_url: str = ""


class ConfirmImplementationRequest(BaseModel):
    branch_name: str
    commit_message: str
    changed_files: list[str]
    summary: str
    github_connection: Optional[GitHubConnectionRequest] = Field(default=None)


class ConfirmImplementationResponse(BaseModel):
    summary: str
    branch_name: str
    commit_message: str
    changed_files: list[str]
    pushed: bool
    pr_url: str


class GitHubAuthStatusRequest(BaseModel):
    github_connection: Optional[GitHubConnectionRequest] = Field(default=None)


class GitHubAuthStatusResponse(BaseModel):
    connected: bool
    message: str
    repo_access: Optional[bool] = None


class SessionResponse(BaseModel):
    session_id: str


class OpenAIModelResponse(BaseModel):
    id: str
    owned_by: str = ""
    created: Optional[int] = None


class OpenAIModelsResponse(BaseModel):
    models: list[OpenAIModelResponse]


# ── Endpoints ────────────────────────────────────────────────────────────


@app.post("/api/session", response_model=SessionResponse)
async def create_session():
    return SessionResponse(session_id=str(uuid.uuid4()))


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    try:
        context_prompt = build_context_prompt()
        result = await chat(
            req.session_id, req.message,
            model=req.model,
            project_context=context_prompt,
        )
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
    try:
        contents = await file.read()
        try:
            file_text = contents.decode("utf-8")
        except UnicodeDecodeError:
            file_text = f"[Binary file uploaded: {file.filename}]"

        context_prompt = build_context_prompt()
        result = await chat(
            session_id, message,
            file_content=file_text,
            model=model,
            project_context=context_prompt,
        )
        return ChatResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"LLM call failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/generate-prd", response_model=PRDResponse)
async def generate_prd_endpoint(req: PRDRequest):
    try:
        context_prompt = build_context_prompt()
        result = await generate_prd(
            req.session_id,
            model=req.model,
            project_context=context_prompt,
        )
        return PRDResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"PRD generation failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/generate-code", response_model=CodeResponse)
async def generate_code_endpoint(req: CodeRequest):
    try:
        context_prompt = build_context_prompt()
        result = await generate_code(
            req.session_id,
            model=req.model,
            project_context=context_prompt,
        )
        return CodeResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"Code generation failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/implement-code", response_model=ImplementCodeResponse)
async def implement_code_endpoint(req: ImplementCodeRequest):
    try:
        root = os.environ.get("GOODBOI_PROJECT_ROOT", "")
        if not root:
            return JSONResponse(
                status_code=400,
                content={"detail": "No target project root is configured."},
            )

        session = get_session_state(req.session_id)
        prd_markdown = session.get("prd_markdown", "")
        feature_summary = session.get("feature_summary", "")
        if not prd_markdown:
            return JSONResponse(
                status_code=400,
                content={"detail": "No PRD exists for this session. Generate the PRD first."},
            )

        result = prepare_code_implementation(
            project_root=Path(root),
            feature_summary=feature_summary,
            prd_markdown=prd_markdown,
            project_context=build_context_prompt(),
            model=req.model,
            github_connection=(req.github_connection.model_dump() if req.github_connection else None),
        )
        return ImplementCodeResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"Implementation failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/confirm-implementation", response_model=ConfirmImplementationResponse)
async def confirm_implementation_endpoint(req: ConfirmImplementationRequest):
    try:
        root = os.environ.get("GOODBOI_PROJECT_ROOT", "")
        if not root:
            return JSONResponse(
                status_code=400,
                content={"detail": "No target project root is configured."},
            )

        result = confirm_code_implementation(
            project_root=Path(root),
            branch_name=req.branch_name,
            commit_message=req.commit_message,
            changed_files=req.changed_files,
            summary=req.summary,
            github_connection=(req.github_connection.model_dump() if req.github_connection else None),
        )
        return ConfirmImplementationResponse(**result)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"Push/PR failed: {type(e).__name__}: {str(e)}"},
        )


@app.post("/api/github-auth-status", response_model=GitHubAuthStatusResponse)
async def github_auth_status_endpoint(req: GitHubAuthStatusRequest):
    try:
        root = os.environ.get("GOODBOI_PROJECT_ROOT", "") or os.getcwd()
        result = get_github_auth_status(
            project_root=Path(root),
            github_connection=(req.github_connection.model_dump() if req.github_connection else None),
        )
        return GitHubAuthStatusResponse(**result)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"GitHub auth check failed: {type(e).__name__}: {str(e)}"},
        )


@app.get("/api/models", response_model=OpenAIModelsResponse)
async def list_openai_models():
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return JSONResponse(
            status_code=500,
            content={"detail": "OPENAI_API_KEY is not set."},
        )

    req = urllib_request.Request(
        "https://api.openai.com/v1/models",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="GET",
    )

    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to list OpenAI models: {body or str(e)}"},
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to list OpenAI models: {type(e).__name__}: {str(e)}"},
        )

    models = payload.get("data", [])
    serialized = [
        {
            "id": model.get("id", ""),
            "owned_by": model.get("owned_by", ""),
            "created": model.get("created"),
        }
        for model in models
        if model.get("id")
    ]
    serialized.sort(key=lambda model: model["id"].lower())
    return OpenAIModelsResponse(models=serialized)


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    return get_session_state(session_id)


@app.get("/api/project")
async def get_project_info():
    """Return project metadata for the frontend."""
    ctx = get_project_context()
    config = get_project_config()
    root = os.environ.get("GOODBOI_PROJECT_ROOT", "")
    return {
        "project_root": root,
        "project_name": Path(root).name if root else "Unknown",
        "has_context": ctx is not None,
        "file_count": len(ctx.get("code_summaries", {})) if ctx else 0,
        "summary_preview": (ctx.get("project_summary", "")[:500] if ctx else ""),
    }


@app.post("/api/refresh")
async def refresh_project():
    """Re-index the project (called from UI)."""
    reload_context()
    return {"status": "ok"}


@app.get("/api/health")
async def health():
    has_key = bool(os.environ.get("OPENAI_API_KEY"))
    root = os.environ.get("GOODBOI_PROJECT_ROOT", "")
    return {
        "status": "ok",
        "openai_key_set": has_key,
        "project_root": root,
    }


# ── Static frontend (mounted last so API routes take priority) ───────────

_static_dir = Path(__file__).parent / "static"
if _static_dir.exists() and any(_static_dir.iterdir()):
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="frontend")
