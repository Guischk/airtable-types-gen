#!/usr/bin/env python3
"""Read files only: reject known incident markers and automatic editor tasks."""
import os
import re
import sys
from pathlib import Path

# Split markers keep this policy from matching its own definitions.
MARKERS = (
    b'0xa322e5f3d311d3080e6f' + b'0121063e9adc2490ef1a',
    b'0x5bdab7ae5bdab7ae6865' + b'6c6c6f6970626f742121',
    '.'.join(str(octet) for octet in (91, 218, 183, 174)).encode(),
    b'files.catbox.moe/' + b'w8aq85.js',
)
AUTO_TASK = re.compile(rb'"runOn"\s*:\s*"folderOpen"')
FONT_EXEC = re.compile(rb'\bnode(?:\.exe)?\b[^\r\n]{0,1000}\.(?:woff2?|ttf|otf)\b', re.IGNORECASE)

def inspect(root):
    failures = []
    for base, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d != '.git' and not (Path(base) / d).is_symlink()]
        for name in files:
            path = Path(base) / name
            if path.is_symlink():
                continue
            relative = path.relative_to(root).as_posix()
            previous = b''
            try:
                with path.open('rb') as stream:
                    while chunk := stream.read(1024 * 1024):
                        data = previous + chunk
                        if any(marker.lower() in data.lower() for marker in MARKERS):
                            failures.append((relative, 'known-incident-marker'))
                            break
                        if relative.endswith('.vscode/tasks.json') and (AUTO_TASK.search(data) or FONT_EXEC.search(data)):
                            failures.append((relative, 'automatic-editor-task-or-font-execution'))
                            break
                        previous = data[-4096:]
            except OSError:
                failures.append((relative, 'unreadable-file'))
    return failures

def main():
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        raise SystemExit('Scan directory unavailable')
    findings = inspect(root)
    for path, reason in findings:
        # Do not include matching source text or environment values in logs.
        print(f'{reason}: {path!r}')
    print(f'Incident policy: {len(findings)} finding(s)')
    raise SystemExit(1 if findings else 0)

if __name__ == '__main__':
    main()
