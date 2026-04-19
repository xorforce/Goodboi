"""CLI entrypoint for goodboi.

Commands:
    goodboi init     -- Scan project & generate .goodboi/ config
    goodboi start    -- Start the dashboard server
    goodboi refresh  -- Re-scan the project and update context
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()


@click.group()
@click.version_option(package_name="goodboi")
def cli():
    """AI-powered PRD generator that onboards to any project."""
    pass


@cli.command()
@click.option(
    "--path", "-p",
    default=".",
    type=click.Path(exists=True, file_okay=False),
    help="Project root directory (defaults to current directory)",
)
@click.option(
    "--model", "-m",
    default="gpt-4o-mini",
    help="LLM model for indexing (gpt-4o-mini recommended to save cost)",
)
def init(path: str, model: str):
    """Scan a project and create .goodboi/ configuration."""
    project_root = Path(path).resolve()

    console.print(Panel(
        f"[bold]Initializing goodboi[/bold]\n"
        f"Project: [cyan]{project_root}[/cyan]\n"
        f"Model:   [cyan]{model}[/cyan]",
        border_style="blue",
    ))

    # Check for API key
    if not os.environ.get("OPENAI_API_KEY"):
        env_file = project_root / ".env"
        if env_file.exists():
            from dotenv import load_dotenv
            load_dotenv(env_file)

    if not os.environ.get("OPENAI_API_KEY"):
        console.print("[red]Error:[/red] OPENAI_API_KEY is not set.")
        console.print("Set it via environment variable or create a .env file in the project root.")
        sys.exit(1)

    from ..indexer.scanner import scan_project
    from ..indexer.summarizer import build_project_context
    from ..indexer.config import (
        ensure_agent_dir,
        save_config,
        save_context,
        build_default_config,
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        # Step 1: Scan file tree
        task = progress.add_task("Scanning project files...", total=None)
        scan = scan_project(project_root)
        progress.update(task, description=(
            f"Found {len(scan.files)} files "
            f"({len(scan.code_files)} code, {len(scan.docs)} docs)"
        ))
        progress.advance(task)

        # Step 2: Summarize with LLM
        progress.update(task, description="Building project context with LLM...")
        context = build_project_context(scan, model=model)
        progress.update(task, description="Project context built")
        progress.advance(task)

        # Step 3: Save config and context
        progress.update(task, description="Saving configuration...")
        ensure_agent_dir(project_root)
        config = build_default_config(context["project_summary"])
        save_config(project_root, config)
        save_context(project_root, context)
        progress.update(task, description="Configuration saved")

    console.print()
    console.print(f"  [green]Created[/green] .goodboi/config.yaml")
    console.print(f"  [green]Created[/green] .goodboi/context.json")
    console.print()

    # Show detected info
    file_tree_preview = "\n".join(scan.tree_string.split("\n")[:20])
    if len(scan.tree_string.split("\n")) > 20:
        file_tree_preview += "\n  ... (truncated)"
    console.print(Panel(file_tree_preview, title="Project Structure", border_style="dim"))

    console.print()
    console.print("[bold green]Ready![/bold green] Start the dashboard with:")
    console.print()
    console.print("  [cyan]goodboi start[/cyan]")
    console.print()


@cli.command()
@click.option(
    "--path", "-p",
    default=".",
    type=click.Path(exists=True, file_okay=False),
    help="Project root directory",
)
@click.option("--port", default=8000, help="Port to serve on")
@click.option("--host", default="0.0.0.0", help="Host to bind to")
def start(path: str, port: int, host: str):
    """Start the goodboi dashboard server."""
    project_root = Path(path).resolve()

    from ..indexer.config import load_config, load_context, get_agent_dir

    agent_dir = get_agent_dir(project_root)
    if not agent_dir.exists():
        console.print("[red]Error:[/red] .goodboi/ not found.")
        console.print("Run [cyan]goodboi init[/cyan] first.")
        sys.exit(1)

    config = load_config(project_root)
    context = load_context(project_root)

    if not context:
        console.print("[yellow]Warning:[/yellow] No project context found. Run [cyan]goodboi refresh[/cyan] to index.")

    # Load .env from project root if present
    env_file = project_root / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)

    if not os.environ.get("OPENAI_API_KEY"):
        console.print("[red]Error:[/red] OPENAI_API_KEY is not set.")
        sys.exit(1)

    # Pass project info to the server via env vars
    os.environ["GOODBOI_PROJECT_ROOT"] = str(project_root)
    os.environ["GOODBOI_CONFIG_DIR"] = str(agent_dir)

    port = config.get("settings", {}).get("port", port)

    console.print(Panel(
        f"[bold]goodboi dashboard[/bold]\n"
        f"Project: [cyan]{project_root.name}[/cyan]\n"
        f"URL:     [cyan]http://localhost:{port}[/cyan]",
        border_style="green",
    ))

    import uvicorn
    uvicorn.run(
        "goodboi.server:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


@cli.command()
@click.option(
    "--path", "-p",
    default=".",
    type=click.Path(exists=True, file_okay=False),
    help="Project root directory",
)
@click.option("--model", "-m", default="gpt-4o-mini", help="LLM model for indexing")
def refresh(path: str, model: str):
    """Re-scan the project and update cached context."""
    project_root = Path(path).resolve()

    from ..indexer.config import get_agent_dir, save_context, load_config, save_config
    from ..indexer.scanner import scan_project
    from ..indexer.summarizer import build_project_context

    agent_dir = get_agent_dir(project_root)
    if not agent_dir.exists():
        console.print("[red]Error:[/red] .goodboi/ not found. Run [cyan]goodboi init[/cyan] first.")
        sys.exit(1)

    # Load .env
    env_file = project_root / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)

    if not os.environ.get("OPENAI_API_KEY"):
        console.print("[red]Error:[/red] OPENAI_API_KEY is not set.")
        sys.exit(1)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Re-scanning project...", total=None)
        scan = scan_project(project_root)
        progress.update(task, description="Rebuilding project context...")
        context = build_project_context(scan, model=model)
        save_context(project_root, context)

        # Update project_summary in config
        config = load_config(project_root)
        config["project_summary"] = context["project_summary"]
        save_config(project_root, config)

    console.print("[green]Context refreshed.[/green]")


if __name__ == "__main__":
    cli()
