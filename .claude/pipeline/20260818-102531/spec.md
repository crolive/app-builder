# Task CLI

## Purpose
Task CLI is a command-line tool for managing a personal task list without leaving the terminal. It solves the problem of needing a quick, no-frills way to add, view, and complete tasks as part of a terminal-based workflow, with no accounts, syncing, or network dependency. It is intended for individual developers. Success looks like: a developer runs `task add`, `task list`, `task complete`, and `task delete` from any directory, tasks persist across separate invocations of the tool, and the tool never makes a network call.

## Tech Stack & Constraints
- **Language/runtime:** Node.js, targeting the current LTS release. No minimum version is enforced via `package.json` `engines` (no hard pin).
- **CLI argument parsing:** Node's built-in `util.parseArgs` only. No third-party CLI parsing library (e.g. `commander`, `yargs`) may be used.
- **Invocation style:** Installed as a global binary via npm, using a `bin` entry in `package.json`. Invoked as a plain command, e.g. `task add "..."`, not via `node index.js ...`.
- **Persistence:** A local JSON file. No database (embedded or external) of any kind.
- **Test framework:** Node's built-in `node:test` runner only. No third-party test framework (e.g. Jest, Mocha, Vitest).
- **Hard constraint:** The tool must make zero network requests and have zero dependency on external services or APIs to perform any of its functions.
- **Hard constraint:** No third-party runtime dependencies for argument parsing or testing (per above). Other third-party dependencies are not required to satisfy this spec and should not be added.

## Non-Goals
- Task synchronization across devices, accounts, or machines
- Due dates or any date/time scheduling on tasks
- Task priorities, tags, or labels
- Task editing (modifying a task's description after creation)
- User authentication or multi-user support
- Any external API or network integration
- A graphical or web-based UI
- Undo/redo functionality
- Task search or filtering
- Multiple/named task lists or projects
- Task reordering or sorting options beyond the fixed order defined in this spec

## Core Features

1. **Add a task.** User runs `task add "<description>"` with a non-empty description. The tool appends a new task to the persistent task list with a unique auto-incrementing integer ID and `completed: false`. If the description is missing or empty (empty string or whitespace-only), the command fails with an error message and no task is added. On success, the tool prints a confirmation message including the new task's ID and description, and the task list file is updated on disk before the process exits.

2. **List tasks.** User runs `task list`. The tool prints every task in the persistent task list to stdout, each showing at minimum its ID, completion status, and description, in ascending ID order. If there are no tasks, the tool prints a message indicating the list is empty (not an error). This command never modifies the task list file.

3. **Complete a task.** User runs `task complete <id>` where `<id>` is an existing task's integer ID. The tool marks that task as completed (`completed: true`) in the persistent task list and prints a confirmation message. If `<id>` is not a valid integer, the command fails with an error message and no change is made. If `<id>` does not match any existing task, the command fails with a "task not found" error message and no change is made. If the task is already completed, the command still succeeds (marks it completed again, no error) and prints the same confirmation message.

4. **Delete a task.** User runs `task delete <id>` where `<id>` is an existing task's integer ID. The tool permanently removes that task from the persistent task list and prints a confirmation message. If `<id>` is not a valid integer, the command fails with an error message and no change is made. If `<id>` does not match any existing task, the command fails with a "task not found" error message and no change is made. Deleted IDs are never reused by subsequent `add` commands.

5. **Local persistence.** All task data is stored in a single JSON file on the local filesystem at `~/.task-cli/tasks.json` (where `~` resolves to the current user's home directory via Node's `os.homedir()`). Data survives between separate invocations of the CLI — each command reads the current file state at the start of its run and writes the updated state back at the end of any run that changes data. If the file does not exist yet (first run), the tool creates the containing directory and the file automatically with an empty task list, rather than erroring. If the file exists but contains invalid/corrupted JSON, the command fails with a clear error message and exits non-zero without overwriting the file.

6. **Fully offline operation.** No command makes any network request, and no command depends on any external service or API to complete successfully. This is satisfied structurally: the implementation must contain no HTTP client usage, no fetch calls, and no network socket usage anywhere in the codebase.

## Data Model

The task data file is a single JSON file at `~/.task-cli/tasks.json` with the following shape:

```json
{
  "nextId": 3,
  "tasks": [
    { "id": 1, "description": "Buy milk", "completed": false },
    { "id": 2, "description": "Clean house", "completed": true }
  ]
}
```

Field definitions:
- `nextId` (integer, required): the ID to assign to the next task created by `add`. Starts at `1` for a fresh file. Incremented by 1 every time `add` successfully creates a task. Never decremented, including after `delete`, so IDs are never reused.
- `tasks` (array, required): the list of all tasks. May be empty.
  - `id` (integer, required): unique identifier for the task, assigned at creation time from `nextId`.
  - `description` (string, required): the task's text, exactly as provided to `add` (trimmed of leading/trailing whitespace, otherwise unmodified).
  - `completed` (boolean, required): `false` when created; `true` once `complete` has been run on it.

A fresh/empty task list file is: `{ "nextId": 1, "tasks": [] }`.

## Interface / API

Binary name: `task` (registered via the `bin` field in `package.json`).

### `task add "<description>"`
- Exactly one positional argument: the description. It must be provided and, after trimming whitespace, must be non-empty.
- On success: prints `Added task <id>: <description>` to stdout. Exit code `0`.
- On missing/empty description: prints `Error: task description is required` to stderr. Exit code `1`.

### `task list`
- No arguments.
- On success with one or more tasks: prints one line per task, in ascending `id` order, to stdout, in the exact format:
  `[<x or space>] <id>  <description>`
  - Completed tasks use `x` inside the brackets: `[x] 2  Clean house`
  - Pending tasks use a space inside the brackets: `[ ] 1  Buy milk`
- On success with zero tasks: prints `No tasks found.` to stdout.
- Exit code `0` in both cases (an empty list is not an error).

### `task complete <id>`
- Exactly one positional argument: the task ID.
- `<id>` must parse as a base-10 integer (leading/trailing whitespace tolerated, e.g. via `Number.parseInt`/equivalent strict validation that rejects non-numeric strings like `"abc"`).
- On success: prints `Completed task <id>: <description>` to stdout. Exit code `0`.
- On non-integer `<id>`: prints `Error: invalid task id "<id>"` to stderr. Exit code `1`.
- On integer `<id>` with no matching task: prints `Error: task <id> not found` to stderr. Exit code `1`.

### `task delete <id>`
- Exactly one positional argument: the task ID.
- Same `<id>` validation rules as `complete`.
- On success: prints `Deleted task <id>: <description>` to stdout. Exit code `0`.
- On non-integer `<id>`: prints `Error: invalid task id "<id>"` to stderr. Exit code `1`.
- On integer `<id>` with no matching task: prints `Error: task <id> not found` to stderr. Exit code `1`.

### No command / unrecognized command
- Running `task` with no subcommand, or with a subcommand that is not one of `add`, `list`, `complete`, `delete`, prints a usage message to stderr listing the four valid subcommands and their expected arguments, and exits with code `1`.

### Data file errors (all commands)
- If `~/.task-cli/tasks.json` exists but does not contain valid JSON matching the Data Model shape, the command prints `Error: task data file is corrupted` to stderr and exits with code `1`, without modifying the file.
- If the `~/.task-cli` directory or `tasks.json` file does not exist, it is created automatically (directory recursively, file with the empty-list default shown in Data Model) before the requested operation proceeds; this is not an error.

### Exit codes (summary)
- `0`: command completed successfully (including a successful `list` of zero tasks).
- `1`: any validation error, not-found error, corrupted-data error, or unrecognized/missing subcommand.

## Acceptance Criteria

- [ ] `task add "<description>"` with a non-empty description creates a new task with a unique integer ID and `completed: false`, prints `Added task <id>: <description>`, and exits `0`.
- [ ] `task add` with no description argument, an empty string, or a whitespace-only string fails, prints an error to stderr, exits `1`, and does not add a task.
- [ ] Task IDs are assigned starting at `1` and increment by `1` for each successfully added task, regardless of deletions.
- [ ] `task list` prints one line per existing task in ascending ID order, each showing the task's ID, completion status (`[x]` or `[ ]`), and description.
- [ ] `task list` prints `No tasks found.` and exits `0` when the task list is empty.
- [ ] `task list` never modifies `~/.task-cli/tasks.json`.
- [ ] `task complete <id>` for an existing task's ID marks it `completed: true`, prints `Completed task <id>: <description>`, and exits `0`.
- [ ] `task complete <id>` for a non-integer ID fails, prints an error to stderr, exits `1`, and does not modify any task.
- [ ] `task complete <id>` for an integer ID with no matching task fails with a "not found" error to stderr, exits `1`, and does not modify any task.
- [ ] `task complete <id>` run twice on the same valid ID succeeds both times without error.
- [ ] `task delete <id>` for an existing task's ID permanently removes it from the task list, prints `Deleted task <id>: <description>`, and exits `0`.
- [ ] `task delete <id>` for a non-integer ID fails, prints an error to stderr, exits `1`, and does not modify the task list.
- [ ] `task delete <id>` for an integer ID with no matching task fails with a "not found" error to stderr, exits `1`, and does not modify the task list.
- [ ] After `task delete <id>`, that ID is never reused by a subsequent `task add`.
- [ ] Data persists across separate process invocations: a task added in one `task add` invocation appears in a `task list` run as a separate, later invocation.
- [ ] All task data is stored at `~/.task-cli/tasks.json` and nowhere else on disk.
- [ ] On first run (no existing `~/.task-cli` directory or `tasks.json` file), the tool creates them automatically instead of erroring, and behaves as if starting from an empty task list.
- [ ] If `~/.task-cli/tasks.json` contains invalid JSON, every command fails with a "corrupted" error to stderr, exits `1`, and does not overwrite the existing file contents.
- [ ] Running `task` with no subcommand, or with an unrecognized subcommand, prints a usage message to stderr and exits `1`.
- [ ] The codebase contains no HTTP client, `fetch`, or network socket usage anywhere (verifiable by source inspection).
- [ ] The tool is invocable as a plain global command (`task ...`) after install, per the `bin` entry in `package.json`, not only via `node <file> ...`.
- [ ] Argument parsing is implemented using Node's built-in `util.parseArgs`, with no third-party CLI parsing library present in dependencies.
- [ ] Tests are implemented using Node's built-in `node:test` runner, with no third-party test framework present in dependencies.
- [ ] `package.json` does not pin a minimum Node version via `engines`.

## Open Questions Resolved
- Task IDs are auto-incrementing integers starting at `1`, tracked via a persisted `nextId` counter in the data file; IDs are never reused after deletion.
- The data file lives at `~/.task-cli/tasks.json`, resolved via `os.homedir()`; the directory and file are auto-created on first use rather than requiring manual setup.
- The `list` command output format is fixed plain text: `[x] <id>  <description>` for completed tasks and `[ ] <id>  <description>` for pending tasks, in ascending ID order; an empty list prints `No tasks found.` rather than nothing or an error.
- All error conditions (missing/empty description, non-integer ID, ID not found, corrupted data file, unrecognized subcommand) print a specific error message to stderr and exit with code `1`; success always exits with code `0`. No other exit codes are used.
- Node.js version target is the current LTS; no minimum is pinned in `package.json` `engines`.
- CLI argument parsing uses Node's built-in `util.parseArgs` exclusively; no third-party parsing library.
- The CLI is installed as a global npm binary (via a `bin` entry in `package.json`) and invoked as a plain command (e.g. `task add "..."`), not via `node index.js ...`.
- Testing uses Node's built-in `node:test` runner exclusively; no third-party test framework.
- Completing an already-completed task is not an error; it succeeds idempotently.
