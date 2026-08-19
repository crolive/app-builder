# QA Report — Todo Tracker — Attempt 1

## Verdict
**PASS WITH WARNINGS**

## Acceptance Criteria Results

| Criteria | Result | Notes |
|---|---|---|
| `todo add "buy milk"` exits code 0 and prints `Added task 1: buy milk` to stdout when no tasks exist | PASS | |
| Second `todo add` (after first) produces task ID 2 | PASS | |
| `todo add` with no description exits code 1 and prints `Error: task description is required.` to stderr | PASS | |
| `todo add ""` (empty string) exits code 1 and prints `Error: task description is required.` to stderr | PASS | |
| `todo list` when no tasks exist prints `No tasks found.` to stdout and exits code 0 | PASS | |
| `todo list` after two adds prints both tasks one-per-line in `[<id>] [<status>] <description>` format, ascending ID order, exits code 0 | PASS | Output: `[1] [pending] buy milk` / `[2] [pending] walk dog` |
| `todo complete 1` after adding task exits code 0 and prints `Completed task 1.` to stdout | PASS | |
| After `todo complete 1`, `todo list` shows task 1 with status `complete` | PASS | |
| `todo complete 1` on already-complete task exits code 0 and prints `Task 1 is already complete.`; file not altered | PASS | File mtime confirmed unchanged |
| `todo complete 99` when task 99 does not exist exits code 1 and prints `Error: task 99 not found.` to stderr | PASS | |
| `todo complete` with no ID exits code 1 and prints `Error: task ID is required.` to stderr | PASS | |
| `todo delete 1` after adding task exits code 0 and prints `Deleted task 1.` to stdout | PASS | |
| After `todo delete 1`, `todo list` does not show task 1 | PASS | List prints `No tasks found.` |
| `todo delete 99` when task 99 does not exist exits code 1 and prints `Error: task 99 not found.` to stderr | PASS | |
| `todo delete` with no ID exits code 1 and prints `Error: task ID is required.` to stderr | PASS | |
| After deleting a task, a new add produces an ID higher than all previously created IDs (no ID reuse) | PASS | Delete task 1, add new task → ID 3 (max was 2) |
| `tasks.json` is located at `~/.todo-tracker/tasks.json` after first `todo add` | PASS | File confirmed at `C:\Users\Carter\.todo-tracker\tasks.json` |
| `~/.todo-tracker/` is created automatically if missing | PASS | Directory removed, then `todo add` recreated it |
| `tasks.json` contains valid JSON matching schema `{ "tasks": [ { "id": <int>, "description": <string>, "status": <"pending"\|"complete"> } ] }` | PASS | Validated: id=int, description=string, status=pending |
| Task data persists across separate process invocations | PASS | Data written by one invocation read correctly by next |
| Corrupted `tasks.json` causes any command to exit code 1 and print `Error: tasks.json is corrupted. Please delete ~/.todo-tracker/tasks.json and try again.` to stderr | PASS | |
| Entry point contains shebang `#!/usr/bin/env node` as first line | PASS | |
| `package.json` contains `bin` field mapping `"todo"` to entry point script | PASS | `"todo": "./index.js"` |
| `package.json` contains `engines` field specifying `"node": ">=18"` | PASS | |
| `todo <unknown-command>` exits code 1 and displays usage/help output | PASS WITH WARNINGS | Exits code 1 and help displayed to stdout, but error message appears twice in stderr (see Warnings) |
| Output of `todo list` can be piped to another command without error | PASS | Piped through `findstr`, exit code 0, output intact |

## Critical Issues
None.

## Warnings
**[WARNING]** Unknown command handling emits the error message twice to stderr. When `todo foobar` is run, commander internally writes `error: unknown command 'foobar'` to stderr (because `exitOverride()` still lets commander write its own error before throwing), then the catch block in `index.js` writes `err.message` a second time via `process.stderr.write`. The result is two identical `error: unknown command 'foobar'` lines in stderr. The exit code (1) and help output (stdout) are both correct, so the acceptance criterion passes, but any downstream tooling or tests that assert exact stderr content will see the duplicate.

## Suggestions
**[SUGGESTION]** To eliminate the duplicate error in stderr for unknown commands, suppress commander's own error output before the throw by adding `.configureOutput({ writeErr: () => {} })` to the program, and let the catch block remain the sole writer. This keeps full control over the error message format.

**[SUGGESTION]** `todo add ""` (empty string passed as an explicit argument) is caught by the `.trim() === ''` guard inside the action handler rather than by the pre-parse `rawArgs.length < 2` check. This works correctly today, but the two code paths for argument validation (pre-parse and in-action) could be unified for consistency.

## Known Gaps Noted
None. (Dev summary listed no known gaps.)
