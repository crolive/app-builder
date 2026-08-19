# Todo Tracker

## What We're Building
Todo Tracker is a command-line interface tool that lets developers manage a personal task list entirely from the terminal. It solves the problem of needing a lightweight, distraction-free task manager that works offline and integrates naturally into a terminal-based workflow. It is intended for individual developer use with no collaboration or cloud features.

## In Scope
1. **Add a task** — `todo add "<task description>"` appends a new task with a unique ID and pending status to the local JSON data file.
2. **List all tasks** — `todo list` prints all tasks to stdout, displaying each task's ID, status (complete/pending), and description.
3. **Complete a task** — `todo complete <id>` marks the task with the given ID as complete in the local JSON data file.
4. **Delete a task** — `todo delete <id>` permanently removes the task with the given ID from the local JSON data file.
5. **Local persistence** — All task data is stored in a JSON file at `~/.todo-tracker/` and survives process restarts.
6. **Global binary installation** — The tool is installed globally via npm and invoked as `todo` from any directory.
7. **Offline-only operation** — The tool makes no network requests and functions entirely without internet access.

## Out of Scope
- Task synchronization across devices or accounts
- Due dates or scheduling
- Task priorities or tags
- User authentication or multi-user support
- External API integrations of any kind
- A graphical or web-based UI
- Task editing (modifying description after creation)
- Undo/redo functionality
- Task search or filtering

## Technical Decisions
- **Runtime:** Node.js 18 LTS (minimum version)
- **CLI argument parsing:** commander
- **Persistence format:** JSON file
- **Data storage location:** `~/.todo-tracker/` directory
- **Invocation style:** Globally installed npm binary (`todo` command)

## Open Questions Resolved
- **Node.js version:** The tool targets Node.js 18 LTS as the minimum supported version. The spec must include an `engines` field in `package.json` enforcing this.
- **CLI library:** Use `commander` for all argument parsing and command definitions. Do not use any other argument parsing library.
- **Persistence mechanism:** Tasks are stored in a single JSON file within `~/.todo-tracker/`. The spec-writer must define the exact filename (e.g. `tasks.json`) and the JSON schema for the file.
- **Storage location:** The data directory is `~/.todo-tracker/`. The tool must create this directory on first run if it does not exist.
- **Invocation style:** The package must define a `bin` entry in `package.json` so that `npm install -g` makes `todo` available as a global command.

## Risks & Assumptions
- **[ASSUMPTION]** The exact filename within `~/.todo-tracker/` (e.g. `tasks.json`) is not specified — the spec-writer should define and document a sensible default.
- **[ASSUMPTION]** Task IDs are assumed to be auto-incrementing integers or similar simple scheme; the ID generation strategy was not specified in requirements.
- **[ASSUMPTION]** The output format for `todo list` (e.g. plain text, table, color-coded) is unspecified — the spec-writer should choose a readable plain-text format compatible with terminal piping.
- **[ASSUMPTION]** Error handling behavior (e.g. completing a non-existent ID, corrupted JSON file) is not defined — the spec-writer should define sensible error messages and non-zero exit codes.
- **[RISK]** If the user's `PATH` is not configured to include the global npm binary directory, the `todo` command will not be found after installation. This is an environment setup concern outside the tool's control.
- **[ASSUMPTION]** No test framework or coverage requirement was specified. The spec-writer should flag this for the user to confirm before implementation begins.
