"""Repository execution service.

Generates concrete file changes from the coding agent, applies them to the
target repository, creates a branch, commits, and pushes to GitHub.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .agents.coding_agent import generate_repo_change_plan
from .agents.code_review_agent import review_and_fix_changes
from .indexer.config import load_context
from .indexer.scanner import scan_project
from .context import get_validator_template
from .agents.stage_validator_agent import validate_stage_output


def _run(cmd: List[str], cwd: Path, env: Optional[Dict[str, str]] = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _ensure_git_repo(project_root: Path):
    if not (project_root / ".git").exists():
        raise RuntimeError("Target project is not a git repository.")


def _get_worktree_changes(project_root: Path) -> str:
    result = _run(["git", "status", "--porcelain"], project_root)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Failed to check git status.")
    return result.stdout.strip()


def _stash_existing_changes(project_root: Path) -> Optional[str]:
    status = _get_worktree_changes(project_root)
    if not status:
        return None

    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    stash_message = f"goodboi-autostash-{stamp}"
    stash = _run(
        ["git", "stash", "push", "-u", "-m", stash_message],
        project_root,
    )
    if stash.returncode != 0:
        raise RuntimeError(stash.stderr.strip() or "Failed to stash existing changes.")
    return stash_message


def _slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"^-+|-+$", "", value)
    return value[:40] or "feature"


def _build_branch_name(feature_summary: str) -> str:
    first_line = (feature_summary or "").splitlines()[0] if feature_summary else ""
    slug = _slugify(first_line)
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    return f"goodboi/{slug}-{stamp}"


def _checkout_main_branch(project_root: Path):
    verify = _run(["git", "rev-parse", "--verify", "main"], project_root)
    if verify.returncode != 0:
        raise RuntimeError("The target repository does not have a local `main` branch.")

    checkout = _run(["git", "checkout", "main"], project_root)
    if checkout.returncode != 0:
        raise RuntimeError(checkout.stderr.strip() or "Failed to switch to the `main` branch.")


def _read_file(path: Path, max_chars: int = 12000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n... [truncated]"
        return text
    except Exception:
        return ""


def _pick_relevant_files(project_root: Path) -> List[Path]:
    context = load_context(project_root) or {}
    selected: List[Path] = []

    for rel_path in list((context.get("manifest_contents") or {}).keys())[:5]:
        selected.append(project_root / rel_path)
    for rel_path in list((context.get("config_contents") or {}).keys())[:8]:
        selected.append(project_root / rel_path)
    for rel_path in list((context.get("code_summaries") or {}).keys())[:12]:
        selected.append(project_root / rel_path)

    if not selected:
        scan = scan_project(project_root)
        selected.extend([f.absolute_path for f in scan.manifests[:5]])
        selected.extend([f.absolute_path for f in scan.configs[:8]])
        selected.extend([f.absolute_path for f in scan.code_files[:12]])

    unique: List[Path] = []
    seen = set()
    for path in selected:
        if path.exists() and path not in seen:
            unique.append(path)
            seen.add(path)
    return unique


def build_repo_files_context(project_root: Path) -> str:
    files = _pick_relevant_files(project_root)
    blocks = []
    for path in files:
        rel_path = path.relative_to(project_root)
        blocks.append(f"## FILE: {rel_path}\n```\n{_read_file(path)}\n```")
    return "\n\n".join(blocks)


def build_changed_files_context(project_root: Path, changed_files: List[str]) -> str:
    blocks = []
    for rel_path in changed_files:
        path = project_root / rel_path
        if path.exists():
            blocks.append(f"## FILE: {rel_path}\n```\n{_read_file(path)}\n```")
    return "\n\n".join(blocks)


def _validate_target_path(project_root: Path, rel_path: str) -> Path:
    target = (project_root / rel_path).resolve()
    root = project_root.resolve()
    if not str(target).startswith(str(root)):
        raise RuntimeError(f"Refusing to write outside repository: {rel_path}")
    return target


def _apply_files(project_root: Path, files: List[dict]) -> List[str]:
    changed = []
    for file_change in files:
        rel_path = file_change["path"]
        action = file_change.get("action", "update")
        content = file_change["content"]

        if action not in {"create", "update"}:
            raise RuntimeError(f"Unsupported file action: {action}")

        target = _validate_target_path(project_root, rel_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        changed.append(rel_path)
    return changed


def _ensure_gh_available():
    if shutil.which("gh") is None:
        raise RuntimeError("GitHub CLI (`gh`) is not installed.")


def _build_subprocess_env(github_connection: Optional[dict]) -> Dict[str, str]:
    env = os.environ.copy()
    if github_connection and github_connection.get("token"):
        env["GH_TOKEN"] = github_connection["token"]
    return env


def _detect_build_command(project_root: Path) -> Optional[List[str]]:
    context = load_context(project_root) or {}
    manifests = context.get("manifest_contents") or {}

    package_json = manifests.get("package.json")
    if package_json:
        try:
            pkg = json.loads(package_json)
            scripts = pkg.get("scripts", {})
            if scripts.get("build"):
                if (project_root / "pnpm-lock.yaml").exists():
                    return ["pnpm", "build"]
                if (project_root / "yarn.lock").exists():
                    return ["yarn", "build"]
                if (project_root / "bun.lockb").exists() or (project_root / "bun.lock").exists():
                    return ["bun", "run", "build"]
                return ["npm", "run", "build"]
        except Exception:
            pass

    if "pyproject.toml" in manifests or (project_root / "pyproject.toml").exists():
        return ["python", "-m", "compileall", "."]

    return None


def _run_build(project_root: Path, build_command: Optional[List[str]]) -> dict:
    if not build_command:
        return {
            "build_command": "",
            "build_output": "No build command detected.",
            "build_succeeded": True,
            "build_checked": False,
        }

    result = _run(build_command, project_root)
    output = (result.stdout or "") + (("\n" + result.stderr) if result.stderr else "")
    return {
        "build_command": " ".join(build_command),
        "build_output": output.strip(),
        "build_succeeded": result.returncode == 0,
        "build_checked": True,
    }


def _attempt_build_fixes(
    *,
    project_root: Path,
    feature_summary: str,
    prd_markdown: str,
    project_context: str,
    model: Optional[str],
    changed_files: List[str],
    build_command: List[str],
    max_attempts: int = 2,
) -> dict:
    latest = _run_build(project_root, build_command)
    if latest["build_succeeded"]:
        return latest

    for _ in range(max_attempts):
        repo_files_context = build_changed_files_context(project_root, changed_files)
        fix_context = (
            project_context
            + "\n\n<build_failure>\n"
            + f"Command: {' '.join(build_command)}\n\n{latest['build_output']}\n"
            + "</build_failure>"
        )
        plan = generate_repo_change_plan(
            feature_summary=feature_summary,
            prd_markdown=prd_markdown,
            project_context=fix_context,
            repo_files_context=repo_files_context,
            model=model,
        )
        files = plan.get("files", [])
        if not files:
            break
        updated = _apply_files(project_root, files)
        for path in updated:
            if path not in changed_files:
                changed_files.append(path)
        latest = _run_build(project_root, build_command)
        if latest["build_succeeded"]:
            return latest

    return latest


def _verify_github_access(project_root: Path, env: Dict[str, str], github_connection: Optional[dict]):
    _ensure_gh_available()
    auth = _run(["gh", "auth", "status"], project_root, env)
    if auth.returncode != 0:
        raise RuntimeError(auth.stderr.strip() or "GitHub auth is not configured.")

    if github_connection and github_connection.get("owner") and github_connection.get("repo"):
        repo_name = f"{github_connection['owner']}/{github_connection['repo']}"
        view = _run(["gh", "repo", "view", repo_name], project_root, env)
        if view.returncode != 0:
            raise RuntimeError(view.stderr.strip() or f"Cannot access GitHub repo {repo_name}.")


def get_github_auth_status(
    *,
    project_root: Path,
    github_connection: Optional[dict] = None,
) -> dict:
    env = _build_subprocess_env(github_connection)
    _ensure_gh_available()

    auth = _run(["gh", "auth", "status"], project_root, env)
    connected = auth.returncode == 0
    message = (auth.stdout or auth.stderr).strip()

    repo_access = None
    if connected and github_connection and github_connection.get("owner") and github_connection.get("repo"):
        repo_name = f"{github_connection['owner']}/{github_connection['repo']}"
        view = _run(["gh", "repo", "view", repo_name], project_root, env)
        repo_access = view.returncode == 0
        if not repo_access:
            connected = False
            message = view.stderr.strip() or f"Cannot access GitHub repo {repo_name}."

    return {
        "connected": connected,
        "message": message or ("Connected" if connected else "Disconnected"),
        "repo_access": repo_access,
    }


def _create_pull_request(
    *,
    project_root: Path,
    env: Dict[str, str],
    branch_name: str,
    commit_message: str,
    summary: str,
    changed_files: List[str],
    github_connection: Optional[dict],
) -> str:
    body_lines = [
        "## Summary",
        summary,
        "",
        "## Changed Files",
    ]
    body_lines.extend([f"- `{path}`" for path in changed_files])
    body = "\n".join(body_lines)

    cmd = [
        "gh",
        "pr",
        "create",
        "--title",
        commit_message,
        "--body",
        body,
        "--head",
        branch_name,
    ]

    if github_connection and github_connection.get("branch"):
        cmd.extend(["--base", github_connection["branch"]])

    if github_connection and github_connection.get("owner") and github_connection.get("repo"):
        cmd.extend(["--repo", f"{github_connection['owner']}/{github_connection['repo']}"])

    pr = _run(cmd, project_root, env)
    if pr.returncode != 0:
        raise RuntimeError(pr.stderr.strip() or "Failed to create pull request.")

    return pr.stdout.strip().splitlines()[-1].strip()


def prepare_code_implementation(
    *,
    project_root: Path,
    feature_summary: str,
    prd_markdown: str,
    project_context: str,
    model: Optional[str] = None,
    github_connection: Optional[dict] = None,
) -> dict:
    _ensure_git_repo(project_root)
    stash_message = _stash_existing_changes(project_root)
    _checkout_main_branch(project_root)

    branch_name = _build_branch_name(feature_summary)
    checkout = _run(["git", "checkout", "-b", branch_name], project_root)
    if checkout.returncode != 0:
        raise RuntimeError(checkout.stderr.strip() or f"Failed to create branch {branch_name}.")

    repo_files_context = build_repo_files_context(project_root)
    plan = generate_repo_change_plan(
        feature_summary=feature_summary,
        prd_markdown=prd_markdown,
        project_context=project_context,
        repo_files_context=repo_files_context,
        model=model,
    )

    commit_message = plan.get("commit_message", "Implement requested feature")
    files = plan.get("files", [])
    if not files:
        raise RuntimeError("Coding agent produced no file changes.")

    changed_files = _apply_files(project_root, files)
    summary = plan.get("summary", "Implementation applied.")
    if stash_message:
        summary = f"{summary} Existing local changes were stashed as `{stash_message}` before implementation."

    build_command = _detect_build_command(project_root)
    build_result = _attempt_build_fixes(
        project_root=project_root,
        feature_summary=feature_summary,
        prd_markdown=prd_markdown,
        project_context=project_context,
        model=model,
        changed_files=changed_files,
        build_command=build_command or [],
    ) if build_command else _run_build(project_root, None)

    diff = _run(["git", "diff", "--", *changed_files], project_root)
    diff_text = (diff.stdout or diff.stderr or "").strip()

    review_validation_template = get_validator_template("review")
    review_validation_feedback = ""
    for _ in range(3):
        reviewer_result = review_and_fix_changes(
            feature_summary=feature_summary,
            prd_markdown=prd_markdown,
            project_context=project_context,
            changed_files_context=build_changed_files_context(project_root, changed_files),
            diff_markdown=diff_text,
            build_output=build_result["build_output"],
            validation_template=review_validation_template,
            validation_feedback=review_validation_feedback,
            model=model,
        )
        validation = validate_stage_output(
            stage="review",
            artifact=reviewer_result.get("review_markdown", ""),
            validator_template=review_validation_template,
            project_context=project_context,
            model=model,
        )
        if validation.get("valid", True):
            reviewer_result["validation"] = validation
            break
        review_validation_feedback = validation.get("feedback", "")
        reviewer_result["validation"] = validation

    reviewer_files = reviewer_result.get("files", [])
    if reviewer_files:
        reviewed_updates = _apply_files(project_root, reviewer_files)
        for path in reviewed_updates:
            if path not in changed_files:
                changed_files.append(path)
        build_result = _run_build(project_root, build_command)
        diff = _run(["git", "diff", "--", *changed_files], project_root)
        diff_text = (diff.stdout or diff.stderr or "").strip()

    return {
        "summary": summary,
        "branch_name": branch_name,
        "commit_message": commit_message,
        "changed_files": changed_files,
        "stash_message": stash_message or "",
        "diff_markdown": diff_text,
        "review_markdown": reviewer_result.get("review_markdown", ""),
        "reviewed_changes": reviewer_result.get("reviewed_changes", []),
        "fixes_applied": reviewer_result.get("fixes_applied", []),
        **build_result,
    }


def confirm_code_implementation(
    *,
    project_root: Path,
    branch_name: str,
    commit_message: str,
    changed_files: List[str],
    summary: str,
    github_connection: Optional[dict] = None,
) -> dict:
    _ensure_git_repo(project_root)

    current_branch = _run(["git", "branch", "--show-current"], project_root)
    if current_branch.returncode != 0:
        raise RuntimeError(current_branch.stderr.strip() or "Failed to read current branch.")
    if current_branch.stdout.strip() != branch_name:
        checkout = _run(["git", "checkout", branch_name], project_root)
        if checkout.returncode != 0:
            raise RuntimeError(checkout.stderr.strip() or f"Failed to switch to branch {branch_name}.")

    add = _run(["git", "add", *changed_files], project_root)
    if add.returncode != 0:
        raise RuntimeError(add.stderr.strip() or "Failed to stage files.")

    commit = _run(["git", "commit", "-m", commit_message], project_root)
    if commit.returncode != 0:
        raise RuntimeError(commit.stderr.strip() or "Failed to create commit.")

    env = _build_subprocess_env(github_connection)
    _verify_github_access(project_root, env, github_connection)

    push = _run(["git", "push", "-u", "origin", branch_name], project_root, env)
    if push.returncode != 0:
        raise RuntimeError(push.stderr.strip() or "Failed to push branch to origin.")

    pr_url = _create_pull_request(
        project_root=project_root,
        env=env,
        branch_name=branch_name,
        commit_message=commit_message,
        summary=summary,
        changed_files=changed_files,
        github_connection=github_connection,
    )

    return {
        "summary": summary,
        "branch_name": branch_name,
        "commit_message": commit_message,
        "changed_files": changed_files,
        "pushed": True,
        "pr_url": pr_url,
    }
