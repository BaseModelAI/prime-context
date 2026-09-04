#!/usr/bin/env python3
"""Prepare isolated Prime Agent 0.9.1 benchmark hosts."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

PRIME_AGENT_VERSION = "0.9.1"
PRIME_CONTEXT_VERSION = "9.2.0"
PRIME_AGENT_URL = (
    "https://github.com/PrimeIntellect-ai/prime-agent/releases/download/"
    "v0.9.1/prime-agent-0.9.1.tgz"
)
ALLOW_SCRIPTS = f"{PRIME_AGENT_URL},@google/genai,koffi,protobufjs"
HOSTS_SCHEMA = "prime-context.python-realworld-hosts/v1"
ROOT = Path(__file__).resolve().parent


def run(command: list[str], environment: dict[str, str]) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, env=environment, check=True)


def isolated_environment(prefix: Path) -> dict[str, str]:
    home = prefix / "home"
    config = prefix / "config"
    cache = prefix / "npm-cache"
    for path in (home, config, cache):
        path.mkdir(parents=True, exist_ok=True)
    user_config = prefix / "npmrc"
    user_config.write_text("")
    environment = dict(os.environ)
    for key in list(environment):
        if key.startswith("PRIME_AGENT_") or key.startswith("PRIME_CONTEXT_"):
            environment.pop(key, None)
    environment.pop("NODE_PATH", None)
    environment.update({
        "HOME": str(home),
        "PATH": f"{prefix / 'bin'}:{os.environ.get('PATH', '')}",
        "PRIME_AGENT_CODING_AGENT_DIR": str(config),
        "PRIME_CONTEXT_HOME": str(prefix / "prime-context-home"),
        "PRIME_AGENT_TELEMETRY": "0",
        "NPM_CONFIG_PREFIX": str(prefix),
        "NPM_CONFIG_CACHE": str(cache),
        "NPM_CONFIG_USERCONFIG": str(user_config),
        "NPM_CONFIG_AUDIT": "false",
        "NPM_CONFIG_FUND": "false",
    })
    return environment


def executable(prefix: Path, name: str) -> Path:
    path = prefix / "bin" / name
    if not path.is_file() or not os.access(path, os.X_OK):
        raise RuntimeError(f"expected executable was not installed: {path}")
    return path.resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=ROOT.parent.parent / ".benchmark-runs" / "hosts-pa091-pc911",
    )
    parser.add_argument("--force", action="store_true", help="replace an existing host root")
    parser.add_argument("--npm", default=shutil.which("npm") or "npm")
    args = parser.parse_args()

    root = args.root.expanduser().resolve()
    if root.exists():
        if not args.force:
            raise SystemExit(f"host root already exists: {root}; pass --force to replace it")
        shutil.rmtree(root)
    root.mkdir(parents=True)

    vanilla = root / "vanilla"
    current = root / "prime-context"
    vanilla_env = isolated_environment(vanilla)
    current_env = isolated_environment(current)

    for prefix, environment in ((vanilla, vanilla_env), (current, current_env)):
        install_env = dict(environment)
        install_env["NPM_CONFIG_ALLOW_SCRIPTS"] = ALLOW_SCRIPTS
        run(
            [args.npm, "install", "--global", "--prefix", str(prefix), PRIME_AGENT_URL],
            install_env,
        )
        version_result = subprocess.run(
            [str(executable(prefix, "prime-agent")), "--version"],
            env=environment,
            text=True,
            capture_output=True,
            check=True,
        )
        version = "\n".join((version_result.stdout, version_result.stderr)).strip()
        if version != PRIME_AGENT_VERSION:
            raise RuntimeError(f"expected prime-agent {PRIME_AGENT_VERSION}, got {version!r}")

    package_env = dict(current_env)
    package_env["NPM_CONFIG_ALLOW_SCRIPTS"] = ALLOW_SCRIPTS
    current_agent = executable(current, "prime-agent")
    run(
        [str(current_agent), "package", "install", f"npm:prime-agent-context@{PRIME_CONTEXT_VERSION}"],
        package_env,
    )

    patcher = executable(current, "prime-context-patch-agent")
    vanilla_root = vanilla / "lib" / "node_modules" / "prime-agent"
    current_root = current / "lib" / "node_modules" / "prime-agent"
    extension = current / "lib" / "node_modules" / "prime-agent-context"
    extension_manifest = json.loads((extension / "package.json").read_text())
    if extension_manifest.get("name") != "prime-agent-context" or extension_manifest.get("version") != PRIME_CONTEXT_VERSION:
        raise RuntimeError(f"unexpected installed Prime Context manifest: {extension_manifest}")

    run([str(patcher), "--check-stock", str(vanilla_root)], current_env)
    run([str(patcher), "--check-stock", str(current_root)], current_env)
    run([str(patcher), str(current_root)], current_env)
    run([str(patcher), "--check", str(current_root)], current_env)

    manifest = {
        "schema": HOSTS_SCHEMA,
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "prime_agent_version": PRIME_AGENT_VERSION,
        "prime_context_version": PRIME_CONTEXT_VERSION,
        "vanilla_prime_agent": str(executable(vanilla, "prime-agent")),
        "current_prime_agent": str(current_agent),
        "current_extension": str(extension.resolve()),
        "vanilla_package_root": str(vanilla_root.resolve()),
        "current_package_root": str(current_root.resolve()),
    }
    manifest_path = root / "hosts.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    print(f"prepared {manifest_path}")
    print(
        f"python3.12 -E -S {ROOT / 'run.py'} --hosts-manifest {manifest_path}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
