"""Project file-tree scanner.

Walks the project directory, respects .gitignore-style patterns,
and collects metadata about every relevant file.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional

# Directories to always skip
SKIP_DIRS = {
    ".git", ".svn", ".hg",
    "node_modules", "__pycache__", ".venv", "venv", "env",
    ".next", ".nuxt", "dist", "build", "out",
    ".goodboi", ".ruff_cache", ".mypy_cache", ".pytest_cache",
    "coverage", ".turbo", ".vercel", ".netlify",
    "vendor", "Pods",
}

# Extensions considered "documentation"
DOC_EXTENSIONS = {".md", ".mdx", ".rst", ".txt", ".adoc"}

# Extensions considered "source code"
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java",
    ".rb", ".php", ".swift", ".kt", ".c", ".cpp", ".h", ".cs",
    ".vue", ".svelte", ".astro",
}

# Package manifest filenames
MANIFEST_FILES = {
    "package.json", "pyproject.toml", "setup.py", "setup.cfg",
    "Cargo.toml", "go.mod", "Gemfile", "composer.json",
    "pom.xml", "build.gradle", "Makefile", "CMakeLists.txt",
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".env.example", "requirements.txt", "Pipfile",
}

# Config / important root files
CONFIG_FILES = {
    "tsconfig.json", "next.config.js", "next.config.ts", "next.config.mjs",
    "tailwind.config.js", "tailwind.config.ts",
    "vite.config.ts", "vite.config.js",
    ".eslintrc.json", ".prettierrc",
    "jest.config.js", "vitest.config.ts",
}


class FileInfo:
    """Metadata about a single file in the project."""

    def __init__(self, path: Path, project_root: Path):
        self.absolute_path = path
        self.relative_path = path.relative_to(project_root)
        self.name = path.name
        self.extension = path.suffix.lower()
        self.size_bytes = path.stat().st_size if path.exists() else 0

    @property
    def is_doc(self) -> bool:
        return self.extension in DOC_EXTENSIONS

    @property
    def is_code(self) -> bool:
        return self.extension in CODE_EXTENSIONS

    @property
    def is_manifest(self) -> bool:
        return self.name in MANIFEST_FILES

    @property
    def is_config(self) -> bool:
        return self.name in CONFIG_FILES

    @property
    def category(self) -> str:
        if self.is_manifest:
            return "manifest"
        if self.is_config:
            return "config"
        if self.is_doc:
            return "doc"
        if self.is_code:
            return "code"
        return "other"


class ProjectScan:
    """Result of scanning a project directory."""

    def __init__(
        self,
        project_root: Path,
        files: List[FileInfo],
        tree_string: str,
    ):
        self.project_root = project_root
        self.files = files
        self.tree_string = tree_string

    @property
    def docs(self) -> List[FileInfo]:
        return [f for f in self.files if f.is_doc]

    @property
    def code_files(self) -> List[FileInfo]:
        return [f for f in self.files if f.is_code]

    @property
    def manifests(self) -> List[FileInfo]:
        return [f for f in self.files if f.is_manifest]

    @property
    def configs(self) -> List[FileInfo]:
        return [f for f in self.files if f.is_config]


def scan_project(project_root: Path, max_depth: int = 6) -> ProjectScan:
    """Walk the project tree and collect file info + a visual tree string."""
    files: List[FileInfo] = []
    tree_lines: List[str] = [project_root.name + "/"]

    def _walk(directory: Path, prefix: str, depth: int):
        if depth > max_depth:
            return

        try:
            entries = sorted(directory.iterdir(), key=lambda e: (not e.is_dir(), e.name))
        except PermissionError:
            return

        # Filter out skipped dirs
        entries = [
            e for e in entries
            if not (e.is_dir() and e.name in SKIP_DIRS)
            and not e.name.startswith(".")  # skip hidden except specific ones
            or e.name in (".env.example",)
        ]

        for i, entry in enumerate(entries):
            is_last = i == len(entries) - 1
            connector = "└── " if is_last else "├── "
            child_prefix = prefix + ("    " if is_last else "│   ")

            if entry.is_dir():
                tree_lines.append(f"{prefix}{connector}{entry.name}/")
                _walk(entry, child_prefix, depth + 1)
            else:
                tree_lines.append(f"{prefix}{connector}{entry.name}")
                try:
                    fi = FileInfo(entry, project_root)
                    files.append(fi)
                except Exception:
                    pass

    _walk(project_root, "", 0)

    return ProjectScan(
        project_root=project_root,
        files=files,
        tree_string="\n".join(tree_lines),
    )
