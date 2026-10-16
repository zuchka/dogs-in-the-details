#!/usr/bin/env python3
"""Audit publication inputs without printing credentials or matching content.

Checks local .dev.vars credentials against all Git objects (including unreachable
objects), tracked files, and the generated source archive. Outputs only flags
and filenames. Requires Python 3 and Git; never sends data over the network.
"""

import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def local_secrets():
    values = []
    path = ROOT / ".dev.vars"
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        # Account IDs, domains, and other public configuration are not secrets.
        if not re.search(r"KEY|TOKEN|SECRET|PASSWORD", name.upper()):
            continue
        value = value.strip()
        if value[:1] in ("'", '"') and value[-1:] == value[:1]:
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        if len(value) >= 12 and not value.lower().startswith(("your_", "example", "placeholder")):
            values.append(value.encode())
    return values


PATTERNS = [
    rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    rb"\bgh[pousr]_[A-Za-z0-9]{36,}\b",
    rb"\bgithub_pat_[A-Za-z0-9_]{40,}\b",
    rb"\bAKIA[0-9A-Z]{16}\b",
    rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b",
    rb"\bsk_live_[A-Za-z0-9]{20,}\b",
    rb"\bsk-proj-[A-Za-z0-9_-]{30,}\b",
]
ASSIGNMENT = re.compile(
    rb"(?i)(?:api[_-]?key|api[_-]?token|access[_-]?token|secret[_-]?key)"
    rb"[\"']?\s*[:=]\s*[\"']([A-Za-z0-9_-]{20,})[\"']"
)


def forbidden(path):
    parts = Path(path).parts
    filename = parts[-1] if parts else ""
    return (any(part in {"node_modules", "artifacts", "dist", ".wrangler", ".git"} for part in parts)
            or filename == ".dev.vars"
            or filename == "dogs-in-the-details-source.zip"
            or (filename.startswith(".env") and filename != ".env.example")
            or filename.lower().endswith((".pem", ".key", ".p12", ".pfx")))


def main():
    secrets = local_secrets()
    matches, patterns, private_material = set(), set(), set()

    def inspect(data, filename):
        if any(value in data for value in secrets):
            matches.add(filename)
        if any(re.search(pattern, data) for pattern in PATTERNS):
            patterns.add(filename)
        for candidate in ASSIGNMENT.findall(data):
            if not candidate.lower().startswith((b"your_", b"example", b"placeholder", b"test-")):
                patterns.add(filename)
        if re.search(rb"/(?:Users|home)/[A-Za-z0-9_.-]+/", data):
            private_material.add(filename)

    tracked = git("ls-files", "-z").decode().split("\0")
    tracked = [path for path in tracked if path]
    for path in tracked:
        file = ROOT / path
        if file.is_file():
            inspect(file.read_bytes(), path)

    # The filename map covers reachable history; dangling blobs are scanned too.
    names = {}
    for line in git("rev-list", "--objects", "--all").decode().splitlines():
        fields = line.split(" ", 1)
        if len(fields) == 2:
            names[fields[0]] = fields[1]
    historical_forbidden = sorted({path for path in names.values() if forbidden(path)})
    objects = git("cat-file", "--batch-all-objects", "--batch-check=%(objectname) %(objecttype)")
    for line in objects.decode().splitlines():
        object_id, kind = line.split()
        if kind in {"blob", "commit", "tag", "tree"}:
            filename = names.get(object_id, "<Git history metadata or unreachable object>")
            inspect(git("cat-file", kind, object_id), filename)

    archive = ROOT / "public/dogs-in-the-details-source.zip"
    archive_forbidden = []
    archive_has_ui = False
    if archive.exists():
        with zipfile.ZipFile(archive) as source:
            for member in source.infolist():
                if member.is_dir():
                    continue
                if forbidden(member.filename):
                    archive_forbidden.append(member.filename)
                if member.filename.endswith("/src/App.tsx"):
                    archive_has_ui = True
                inspect(source.read(member), f"public/dogs-in-the-details-source.zip:{member.filename}")

    emails = git("log", "--all", "--format=%ae%n%ce").decode().splitlines()
    personal_email = any(email and not email.endswith("@users.noreply.github.com") for email in emails)
    forbidden_tracked = sorted(path for path in tracked if forbidden(path))
    clean = not (matches or patterns or forbidden_tracked or historical_forbidden or archive_forbidden)
    report = {
        "known_secret_values_available": bool(secrets),
        "credential_checks_clear": clean,
        "known_secret_match_files": sorted(matches),
        "token_pattern_files": sorted(patterns),
        "forbidden_tracked_files": forbidden_tracked,
        "forbidden_history_files": historical_forbidden,
        "source_archive_exists": archive.exists(),
        "source_archive_contains_application": archive_has_ui,
        "forbidden_archive_files": sorted(archive_forbidden),
        "local_home_path_files": sorted(private_material),
        "commit_metadata_contains_non_noreply_email": personal_email,
    }
    print(json.dumps(report, indent=2))
    return 0 if clean else 1


if __name__ == "__main__":
    sys.exit(main())
