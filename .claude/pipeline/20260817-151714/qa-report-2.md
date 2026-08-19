# QA Report — Todo Tracker — Attempt 2

## Verdict
**PASS**

## Acceptance Criteria Results

| Criteria | Result | Notes |
|---|---|---|
| `todo add "buy milk"` exits code 0 and prints `Added task 1: buy milk` to stdout when no tasks exist | PASS | |
| `todo add "buy milk"` followed by `todo add "walk dog"` gives second task ID 2 | PASS | |
| `todo add` with no description exits code 1 and prints `Error: task description is required.` to stderr | PASS | Handled via `commander.missingArgument` catch |
| `todo add ""` (empty string) exits code 1 and prints `Error: task description is required.` to stderr | PASS | Empty-string guard in action handler |
| `todo list` when no tasks prints `No tasks found.` to stdout and exits code 0 | PASS | |
| `todo list` after adding two tasks prints both tasks one per line in format `[<id>] [<status>] <description>` in ascending ID order, exits code 0 | PASS | |
| `todo complete 1` after adding task exits code 0 and prints `Completed task 1.` to stdout | PASS | |
| After `todo complete 1`, `todo list` shows task 1 with status `complete` | PASS | |
| `todo complete 1` on already-complete task exits code 0 and prints `Task 1 is already complete.` | PASS | |
| `todo complete 99` when no task 99 exists exits code 1 and prints `Error: task 99 not found.` to stderr | PASS | |
| `todo complete` with no ID exits code 1 and prints `Error: task ID is required.` to stderr | PASS | Handled by `commander.missingArgument` catch block checking subcommand |
| `todo delete 1` after adding task exits code 0 and prints `Deleted task 1.` to stdout | PASS | |
| After `todo delete 1`, `todo list` does not show task with ID 1 | PASS | |
| `todo delete 99` when no task 99 exists exits code 1 and prints `Error: task 99 not found.` to stderr | PASS | |
| `todo delete` with no ID exits code 1 and prints `Error: task ID is required.` to stderr | PASS | Handled by `commander.missingArgument` catch block checking subcommand |
| After deleting a task, adding a new task produces an ID higher than all previously created IDs (no reuse) | PASS | Uses `Math.max(...tasks.map(t => t.id)) + 1` |
| `tasks.json` is located at `~/.todo-tracker/tasks.json` after first `todo add` | PASS | |
| If `~/.todo-tracker/` does not exist before first command, it is created automatically | PASS | `ensureDir()` called in `writeTasks()` |
| `tasks.json` contains valid JSON matching schema `{ "tasks": [ { "id": int, "description": string, "status": "pending"\|"complete" } ] }` | PASS | |
| Task data persists across separate process invocations | PASS | |
| If `tasks.json` contains invalid JSON, any command exits code 1 and prints the corruption error to stderr | PASS | |
| Entry point script contains shebang `#!/usr/bin/env node` as first line | PASS | |
| `package.json` contains `bin` field mapping `"todo"` to entry point script | PASS | `"todo": "./index.js"` |
| `package.json` contains `engines` field specifying `"node": ">=18"` | PASS | |
| `todo <unknown-command>` exits code 1 and displays usage/help output with error appearing only once in stderr | PASS | Error appears exactly once in stderr; help goes to stdout |
| Output of `todo list` can be piped to another command without error | PASS | Piped through `Where-Object`, exit code 0 |

## Critical Issues
None.

## Warnings
None.

## Suggestions
**[SUGGESTION]** The `todo <unknown-command>` behavior routes the usage/help output to stdout and the error message (`error: unknown command 'foobar'`) to stderr. This is the correct Unix convention and passes the acceptance criterion. The concern from attempt 1 (error appearing twice) is fully resolved — stderr now contains exactly one line: `error: unknown command 'foobar'`.

**[SUGGESTION]** The `commander.configureOutput({ writeErr: () => {} })` suppressor, combined with the manual `process.stderr.write(err.message + '\n')` in the catch handler, produces clean, single-emission error output. This approach is correct and robust.

## Known Gaps Noted
None.
