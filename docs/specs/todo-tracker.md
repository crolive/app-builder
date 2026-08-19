# Todo Tracker

## Purpose
Todo Tracker is a command-line tool that gives individual developers a lightweight, distraction-free way to manage a personal task list entirely from the terminal. It solves the problem of needing a simple, offline-capable task manager that integrates naturally into a terminal-based workflow without requiring a browser, cloud account, or heavyweight application. Success means a developer can add, list, complete, and delete tasks using short commands from any directory, with all data persisting locally between sessions.

## Tech Stack & Constraints
- **Runtime:** Node.js 18 LTS (minimum). The `package.json` must include an `engines` field enforcing `"node": ">=18"`.
- **CLI argument parsing:** `commander` library only. No other argument parsing library may be used.
- **Persistence:** A single JSON file named `tasks.json` located at `~/.todo-tracker/tasks.json`.
- **Storage directory:** `~/.todo-tracker/`. The tool must create this directory on first run if it does not exist.
- **Installation:** The package must define a `bin` entry in `package.json` mapping the `todo` command to the entry point, so `npm install -g` makes `todo` available globally.
- **No network requests:** The tool must make zero network requests. No external API calls of any kind.
- **No external runtime dependencies** beyond `commander` and Node.js built-ins.

## Non-Goals
- Task synchronization across devices or accounts.
- Due dates, scheduling, or reminders.
- Task priorities or tags.
- User authentication or multi-user support.
- Any external API or cloud integration.
- A graphical or web-based UI.
- Editing a task's description after creation.
- Undo or redo functionality.
- Task search or filtering.
- Colored or styled terminal output (output must be plain text compatible with piping).
- A test suite (no testing framework is required or expected).

## Core Features

1. **Add a task** — The user runs `todo add "<task description>"`. A new task is appended to `tasks.json` with a unique auto-incrementing integer ID (starting at 1, incrementing by 1 from the highest existing ID), a status of `"pending"`, and the provided description string.
   - If the description argument is missing or empty, the command exits with code 1 and prints `Error: task description is required.` to stderr.
   - If `~/.todo-tracker/` does not exist, it is created before writing.
   - On success, prints `Added task <id>: <description>` to stdout and exits with code 0.

2. **List all tasks** — The user runs `todo list`. All tasks from `tasks.json` are printed to stdout, one task per line, in ascending ID order.
   - Each line follows the format: `[<id>] [<status>] <description>` where `<status>` is either `pending` or `complete`.
   - If there are no tasks, prints `No tasks found.` to stdout and exits with code 0.
   - If `tasks.json` does not exist (no tasks have ever been added), the tool treats this identically to an empty task list.
   - On success, exits with code 0.

3. **Complete a task** — The user runs `todo complete <id>`. The task with the matching integer ID has its status updated to `"complete"` in `tasks.json`.
   - If the `<id>` argument is missing, exits with code 1 and prints `Error: task ID is required.` to stderr.
   - If no task with the given ID exists, exits with code 1 and prints `Error: task <id> not found.` to stderr.
   - If the task is already complete, exits with code 0 and prints `Task <id> is already complete.` to stdout. No write is performed.
   - On success, prints `Completed task <id>.` to stdout and exits with code 0.

4. **Delete a task** — The user runs `todo delete <id>`. The task with the matching integer ID is permanently removed from `tasks.json`.
   - If the `<id>` argument is missing, exits with code 1 and prints `Error: task ID is required.` to stderr.
   - If no task with the given ID exists, exits with code 1 and prints `Error: task <id> not found.` to stderr.
   - On success, prints `Deleted task <id>.` to stdout and exits with code 0.

5. **Local persistence** — All task data is stored in `~/.todo-tracker/tasks.json` and survives process restarts. Every write operation (add, complete, delete) rewrites the full file atomically (write to a temp file in the same directory, then rename).

6. **Global binary installation** — After `npm install -g`, the `todo` command is available from any working directory. The `bin` field in `package.json` must map `"todo"` to the entry point script. The entry point script must include the Node.js shebang line `#!/usr/bin/env node`.

7. **Corrupted or invalid JSON file** — If `tasks.json` exists but cannot be parsed as valid JSON, any command that reads the file exits with code 1 and prints `Error: tasks.json is corrupted. Please delete ~/.todo-tracker/tasks.json and try again.` to stderr.

## Data Model

**File path:** `~/.todo-tracker/tasks.json`

**Top-level structure:** A JSON object with a single key `tasks`, whose value is an array of task objects.

```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Write the spec",
      "status": "pending"
    },
    {
      "id": 2,
      "description": "Implement the CLI",
      "status": "complete"
    }
  ]
}
```

**Task object fields:**

| Field | Type | Values | Description |
|---|---|---|---|
| `id` | integer | >= 1 | Unique, auto-incrementing. Never reused after deletion. |
| `description` | string | non-empty | The task text as provided by the user. |
| `status` | string | `"pending"` or `"complete"` | The current state of the task. |

**ID generation rule:** The next ID is `Math.max(...existingIds) + 1` when tasks exist, or `1` when the task list is empty. IDs are never recycled when tasks are deleted.

**Initial file state:** When the first task is added and the file does not yet exist, the tool creates both the directory and the file, writing a valid JSON object with a `tasks` array containing the single new task.

## Interface / API

**Binary name:** `todo`

**Commands:**

```
todo add "<description>"
todo list
todo complete <id>
todo delete <id>
```

**`todo add "<description>"`**
- Argument: `description` (string, required, positional)
- stdout on success: `Added task <id>: <description>`
- stderr on error: `Error: task description is required.`
- Exit codes: 0 on success, 1 on error

**`todo list`**
- No arguments
- stdout format (one line per task, ascending ID order):
  ```
  [1] [pending] Write the spec
  [2] [complete] Implement the CLI
  ```
- stdout when empty: `No tasks found.`
- Exit codes: 0 always (including empty list)

**`todo complete <id>`**
- Argument: `id` (integer, required, positional)
- stdout on success: `Completed task <id>.`
- stdout when already complete: `Task <id> is already complete.`
- stderr on missing arg: `Error: task ID is required.`
- stderr on not found: `Error: task <id> not found.`
- Exit codes: 0 on success or already-complete, 1 on error

**`todo delete <id>`**
- Argument: `id` (integer, required, positional)
- stdout on success: `Deleted task <id>.`
- stderr on missing arg: `Error: task ID is required.`
- stderr on not found: `Error: task <id> not found.`
- Exit codes: 0 on success, 1 on error

**Unknown commands:** If the user invokes `todo <unknown>`, `commander`'s default help output is shown and the process exits with code 1.

**No arguments:** If the user invokes `todo` with no arguments, `commander`'s default help output is shown and the process exits with code 0.

## Acceptance Criteria

- [ ] Running `todo add "buy milk"` exits with code 0 and prints `Added task 1: buy milk` to stdout when no tasks exist yet.
- [ ] Running `todo add "buy milk"` followed by `todo add "walk dog"` results in the second task having ID 2.
- [ ] Running `todo add` with no description argument exits with code 1 and prints `Error: task description is required.` to stderr.
- [ ] Running `todo add ""` (empty string) exits with code 1 and prints `Error: task description is required.` to stderr.
- [ ] Running `todo list` when no tasks exist prints `No tasks found.` to stdout and exits with code 0.
- [ ] Running `todo list` after adding two tasks prints both tasks, one per line, in the format `[<id>] [<status>] <description>`, in ascending ID order, and exits with code 0.
- [ ] Running `todo complete 1` after adding a task with ID 1 exits with code 0 and prints `Completed task 1.` to stdout.
- [ ] After running `todo complete 1`, running `todo list` shows the task with ID 1 displaying status `complete`.
- [ ] Running `todo complete 1` on a task that is already complete exits with code 0 and prints `Task 1 is already complete.` to stdout, and does not alter the file.
- [ ] Running `todo complete 99` when no task with ID 99 exists exits with code 1 and prints `Error: task 99 not found.` to stderr.
- [ ] Running `todo complete` with no ID argument exits with code 1 and prints `Error: task ID is required.` to stderr.
- [ ] Running `todo delete 1` after adding a task with ID 1 exits with code 0 and prints `Deleted task 1.` to stdout.
- [ ] After running `todo delete 1`, running `todo list` does not show a task with ID 1.
- [ ] Running `todo delete 99` when no task with ID 99 exists exits with code 1 and prints `Error: task 99 not found.` to stderr.
- [ ] Running `todo delete` with no ID argument exits with code 1 and prints `Error: task ID is required.` to stderr.
- [ ] After deleting a task, adding a new task produces an ID higher than all previously created IDs, not reusing the deleted task's ID.
- [ ] `tasks.json` is located at `~/.todo-tracker/tasks.json` after the first `todo add` command.
- [ ] If `~/.todo-tracker/` does not exist before the first command, it is created automatically.
- [ ] `tasks.json` contains valid JSON matching the schema `{ "tasks": [ { "id": <int>, "description": <string>, "status": <"pending"|"complete"> } ] }`.
- [ ] Task data persists across separate process invocations (add a task in one invocation, list shows it in the next).
- [ ] If `tasks.json` contains invalid JSON, any command that reads the file exits with code 1 and prints `Error: tasks.json is corrupted. Please delete ~/.todo-tracker/tasks.json and try again.` to stderr.
- [ ] After `npm install -g`, running `todo` from a directory other than the project root executes the tool successfully.
- [ ] The entry point script contains the shebang line `#!/usr/bin/env node` as its first line.
- [ ] `package.json` contains a `bin` field mapping `"todo"` to the entry point script.
- [ ] `package.json` contains an `engines` field specifying `"node": ">=18"`.
- [ ] Running `todo <unknown-command>` exits with code 1 and displays usage/help output.
- [ ] The output of `todo list` can be piped to another command (e.g. `todo list | grep pending`) without error, confirming plain-text stdout output.

## Open Questions Resolved

- The data file is named `tasks.json` and is located at `~/.todo-tracker/tasks.json`. Do not use any other filename or location.
- The top-level JSON structure is `{ "tasks": [] }`. Do not use a bare array as the top-level value.
- Task IDs are auto-incrementing integers starting at 1. The next ID is always `Math.max(...existingIds) + 1`, or `1` if the list is empty. IDs are never reused after deletion.
- Use `commander` for all argument parsing. Do not use `process.argv` directly or any other argument parsing library.
- The `todo list` output format is `[<id>] [<status>] <description>` with no color, no borders, and no padding. This format must be stable for piping.
- All error messages go to stderr. All success and informational messages go to stdout. This separation must be maintained so that piping stdout does not mix in error output.
- Write operations must use a write-then-rename pattern (write to a temp file in `~/.todo-tracker/`, then `fs.renameSync` to `tasks.json`) to avoid data corruption on interrupted writes.
- No test framework is required. QA verification is performed manually using the Acceptance Criteria above.
- The `engines` field in `package.json` must specify `"node": ">=18"`. Do not target a lower version.
- The tool makes no network requests under any circumstances. Do not import or use any HTTP or network library.
