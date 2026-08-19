# Task CLI

## What We're Building
Task CLI is a command-line tool for managing a personal task list from the terminal. It solves the problem of needing a quick, no-frills way to add, view, and complete tasks without leaving a terminal-based workflow. It is intended for individual developers who want a lightweight personal task list with no accounts, syncing, or extra features.

## In Scope
1. **Add a task** — a command that appends a new task (with a description and a unique identifier) to the persistent task list, defaulting to an incomplete/pending state.
2. **List tasks** — a command that prints all tasks to stdout, showing at minimum each task's identifier, completion status, and description.
3. **Complete a task** — a command that marks an existing task, referenced by its identifier, as done in the persistent task list.
4. **Delete a task** — a command that permanently removes an existing task, referenced by its identifier, from the persistent task list.
5. **Local persistence** — task data survives between separate invocations of the CLI (i.e., is not held only in memory), stored entirely on the local filesystem.
6. **Fully offline operation** — the tool makes no network requests and has no dependency on external services or APIs to perform any of its functions.

## Out of Scope
- Task synchronization across devices, accounts, or machines
- Due dates or any date/time scheduling on tasks
- Task priorities or tags/labels
- Task editing (modifying a task's description after creation)
- User authentication or multi-user support
- Any external API or network integration
- A graphical or web-based UI
- Undo/redo functionality
- Task search or filtering
- Multiple/named task lists or projects

## Technical Decisions
- **Language/runtime:** Node.js, targeting the current LTS release. No minimum version is enforced via `package.json` `engines` (no hard pin).
- **CLI argument parsing:** Node's built-in `util.parseArgs`. No third-party CLI parsing library (e.g. `commander`, `yargs`) is used.
- **Invocation style:** Installed as a global binary via npm, using a `bin` entry in `package.json`. Invoked as a plain command (e.g. `task add "..."`), not via `node index.js ...`.
- **Test framework:** Node's built-in test runner (`node:test`). No third-party test framework (e.g. Jest, Mocha, Vitest) is used.

## Open Questions Resolved
- No database — task state is persisted to a local JSON file rather than any external or embedded database, consistent with the "must run offline" and "no external APIs" constraints and the absence of any database mentioned in requirements.
- Task data is stored at `~/.task-cli/tasks.json`.
- Node.js version target is the current LTS; no minimum is pinned in `package.json` `engines`.
- CLI argument parsing uses Node's built-in `util.parseArgs`; no third-party parsing library.
- The CLI is installed as a global npm binary (via a `bin` entry in `package.json`) and invoked as a plain command (e.g. `task add "..."`), not via `node index.js ...`.
- Testing uses Node's built-in `node:test` runner; no third-party test framework.

## Risks & Assumptions
- **[ASSUMPTION]** Assumed tasks need a simple unique identifier scheme (e.g. auto-incrementing integer) so that `complete` and `delete` can reference a specific task, since requirements describe those operations acting on "a task" without defining how tasks are addressed.
- **[ASSUMPTION]** Output format for the list command (plain text lines vs. an aligned/formatted table) is unspecified — assumed plain, readable terminal output is acceptable, to be finalized by the spec-writer.
- **[ASSUMPTION]** Error handling behavior (e.g. completing/deleting a non-existent task ID, a missing or corrupted data file) is not defined in requirements; the spec-writer should define sensible error messages and exit codes.
