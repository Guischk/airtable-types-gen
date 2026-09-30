#!/usr/bin/env python3
"""Read files only: reject known incident markers and automatic editor tasks."""
import json
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
FONT_EXEC = re.compile(rb'\bnode(?:\.exe)?\b[^\r\n]{0,1000}\.(?:woff2?|ttf|otf)\b', re.IGNORECASE)

def parse_jsonc(data):
    """Remove JSONC comments/trailing commas without changing quoted strings."""
    text = data.decode('utf-8-sig')
    output = []
    index = 0
    quoted = escaped = False
    while index < len(text):
        character = text[index]
        if quoted:
            output.append(character)
            if escaped:
                escaped = False
            elif character == '\\':
                escaped = True
            elif character == '"':
                quoted = False
            index += 1
        elif character == '"':
            quoted = True
            output.append(character)
            index += 1
        elif text.startswith('//', index):
            end = text.find('\n', index + 2)
            end = len(text) if end == -1 else end
            output.extend(' ' for _ in range(end - index))
            index = end
        elif text.startswith('/*', index):
            end = text.find('*/', index + 2)
            if end == -1:
                raise ValueError('Unterminated JSONC comment')
            output.extend('\n' if c == '\n' else ' ' for c in text[index:end + 2])
            index = end + 2
        else:
            output.append(character)
            index += 1
    text = ''.join(output)
    output = []
    quoted = escaped = False
    for index, character in enumerate(text):
        if not quoted and character == ',':
            end = index + 1
            while end < len(text) and text[end].isspace():
                end += 1
            if end < len(text) and text[end] in ']}':
                continue
        output.append(character)
        if quoted:
            if escaped:
                escaped = False
            elif character == '\\':
                escaped = True
            elif character == '"':
                quoted = False
        elif character == '"':
            quoted = True
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('Ambiguous duplicate JSON key')
            result[key] = value
        return result
    return json.loads(''.join(output), object_pairs_hook=unique_object)

def automatic_task(value):
    if isinstance(value, dict):
        return value.get('runOn') == 'folderOpen' or any(automatic_task(item) for item in value.values())
    if isinstance(value, list):
        return any(automatic_task(item) for item in value)
    return False

def inspect_tasks(path):
    try:
        with path.open('rb') as stream:
            data = stream.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            return 'editor-task-file-too-large'
        parsed = parse_jsonc(data)
        if not isinstance(parsed, dict):
            return 'invalid-editor-task-file'
        if automatic_task(parsed) or FONT_EXEC.search(data):
            return 'automatic-editor-task-or-font-execution'
    except (OSError, ValueError, RecursionError):
        return 'invalid-or-unreadable-editor-task-file'
    return None

def inspect(root):
    failures = []
    for base, dirs, files in os.walk(root, followlinks=False):
        for directory in dirs:
            path = Path(base) / directory
            if directory.casefold() == '.vscode' and path.is_symlink():
                failures.append((path.relative_to(root).as_posix(), 'symlinked-editor-configuration'))
        dirs[:] = [d for d in dirs if d != '.git' and not (Path(base) / d).is_symlink()]
        for name in files:
            path = Path(base) / name
            relative = path.relative_to(root).as_posix()
            task_file = relative.casefold().endswith('.vscode/tasks.json')
            if path.is_symlink():
                if task_file or name.casefold() == '.vscode':
                    failures.append((relative, 'symlinked-editor-configuration'))
                continue
            if task_file and (reason := inspect_tasks(path)):
                failures.append((relative, reason))
            previous = b''
            try:
                with path.open('rb') as stream:
                    while chunk := stream.read(1024 * 1024):
                        data = previous + chunk
                        if any(marker.lower() in data.lower() for marker in MARKERS):
                            failures.append((relative, 'known-incident-marker'))
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
