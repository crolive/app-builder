# Dev Summary

## What Was Built

1. **Add a task** — `todo add "<description>"` implemented with auto-incrementing IDs, pending status default, and directory auto-creation on first run.
2. **List all tasks** — `todo list` prints all tasks sorted by ID ascending in `[id] [status] description` format. Empty list prints `No tasks found.`
3. **Complete a task** — `todo complete <id>` marks a task complete, with idempotent handling if already complete.
4. **Delete a task** — `todo delete <id>` removes a task permanently by ID.
5. **Local persistence** — All writes use a write-then-rename pattern via a `.tasks.tmp` file in `~/.todo-tracker/` to prevent corruption.
6. **Global binary** — `package.json` defines `bin.todo` pointing to `index.js`, which has the `#!/usr/bin/env node` shebang. `engines` field set to `>=18`.
7. **Corruption handling** — Any read failure or JSON parse failure exits with code 1 and the specified error message to stderr.

## Implementation Decisions

- **Missing argument detection** — Commander treats `todo complete` (no ID) as an unknown command rather than a missing argument. To produce the correct `Error: task ID is required.` message, the code inspects `process.argv` before calling `program.parse()` and exits early if a subcommand requiring an argument has none.
- **exitOverride()** — Used on the commander program to catch commander's internal exits as thrown errors, allowing control over exit codes and help output for unknown commands and no-argument invocations.
- **stdout/stderr via `process.stdout.write` / `process.stderr.write`** — Used directly instead of `console.log` / `console.error` to ensure no extra formatting and clean pipe behavior.

## Deviations from Spec

None.

## Known Gaps

None.

## Entry Points & Key Files

- Entry point: `todo-tracker/index.js`
- All logic is in a single file — no separate modules.
