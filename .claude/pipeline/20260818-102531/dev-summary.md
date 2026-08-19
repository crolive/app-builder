# Dev Summary

## What Was Built
- **Add a task** — `task add "<description>"` validates and trims the description, assigns the next auto-incrementing ID, appends `{ id, description, completed: false }` to the task list, persists it, and prints `Added task <id>: <description>`.
- **List tasks** — `task list` reads the data file (without writing to it), prints `No tasks found.` when empty, or one line per task in ascending ID order in the exact `[x] <id>  <description>` / `[ ] <id>  <description>` format.
- **Complete a task** — `task complete <id>` validates `<id>` is a base-10 integer, finds the matching task, sets `completed: true`, persists, and prints a confirmation. Re-completing an already-completed task succeeds idempotently.
- **Delete a task** — `task delete <id>` validates `<id>`, removes the matching task from the array (never decrementing `nextId`, so IDs are never reused), persists, and prints a confirmation.
- **Local persistence** — All reads/writes go through `src/store.js`, which resolves `~/.task-cli/tasks.json` via `os.homedir()`, auto-creates the directory and an empty-list file on first run, and detects/reports corrupted or wrong-shaped JSON without overwriting the file.
- **Fully offline operation** — No HTTP/fetch/socket modules are used anywhere in the source; verified both by manual inspection and by an automated test that greps the three source files for `http`/`https`/`net`/`dgram` requires and `fetch(` calls.

## Implementation Decisions
- **Project layout**: `bin/task.js` is a thin executable entry point (shebang + `process.exit(run(...))`) that delegates to `src/cli.js` (dispatch/validation/formatting) and `src/store.js` (data file I/O). This keeps the testable logic out of the process-exiting entry point.
- **Argument parsing**: `util.parseArgs({ args, allowPositionals: true, strict: false })` is used purely to extract positionals (subcommand + its single argument). `strict: false` was chosen because descriptions/IDs could otherwise be misinterpreted as unknown flags (e.g. a description starting with `-`); no named options are defined since the interface only uses positional arguments.
- **ID validation**: `<id>` is validated with a `^-?\d+$` regex after trimming, then parsed with `Number.parseInt`. This accepts surrounding whitespace and rejects non-numeric strings like `"abc"` or `"1.5"` per the spec's `complete`/`delete` rules. A syntactically valid but non-existent integer ID (e.g. a negative number or `99`) correctly falls through to the "not found" branch rather than the "invalid id" branch.
- **`add` with extra positional arguments**: only the first positional after the subcommand is used as the description (matching "exactly one positional argument"); extra stray positionals are silently ignored rather than erroring, since the spec defines no error case for this and typical shell usage always quotes the description into one argument.
- **Data file writes**: JSON is written with 2-space indentation plus a trailing newline for readability; this is an internal formatting choice not specified by the spec and has no effect on the documented behavior.
- **Corruption detection**: beyond JSON.parse failures, `store.js` also validates the parsed object's shape (`nextId` is an integer, `tasks` is an array of `{id: int, description: string, completed: boolean}`) and treats a shape mismatch as corruption too, since the spec requires the file to contain "valid JSON matching the Data Model shape."
- **Testing strategy**: Tests in `test/task.test.js` use `node:test` and spawn the real `bin/task.js` as a child process via `child_process.execFileSync` for true end-to-end coverage (matching how the tool is actually invoked). Each test isolates its data by creating a fresh temp directory and pointing both `HOME` and `USERPROFILE` env vars at it for the child process — `os.homedir()` reads `USERPROFILE` on Windows and `HOME` on POSIX, so this cleanly isolates tests without adding any test-only override hooks to the source code itself (keeping `~/.task-cli/tasks.json` the one true, unconditional data location in production code, per the spec).
- **`package.json`**: no `engines` field (per spec), `type` left as default CommonJS (matches `require`-based source), `bin.task` points at `./bin/task.js`, `scripts.test` runs `node --test`.

## Deviations from Spec
None.

## Known Gaps
None. All Core Features, Interface/API behaviors, and Acceptance Criteria items were implemented, including: ID auto-increment/never-reused, empty-list message, exact list line format, idempotent re-completion, corrupted-file detection without overwrite, auto-creation of the data directory/file on first run, usage message + exit 1 for missing/unrecognized subcommands, `util.parseArgs`-only argument parsing, and `node:test`-only tests.

## Entry Points & Key Files
- **Entry point**: `task-cli/bin/task.js` — shebang executable registered as the `task` binary via `package.json`'s `bin` field.
- **Command dispatch/validation/formatting**: `task-cli/src/cli.js` — `run(argv)` is the single exported function; handles subcommand routing, `add`/`list`/`complete`/`delete` logic, and all stdout/stderr message formatting.
- **Persistence**: `task-cli/src/store.js` — `loadData()`/`saveData()`, path resolution via `os.homedir()`, first-run auto-creation, and corrupted/malformed-data detection (`CorruptedDataError`).
- **Tests**: `task-cli/test/task.test.js` — 24 `node:test` cases covering every acceptance criterion, run via `npm test` (`node --test`) from `task-cli/`. All 24 currently pass.
- **Manifest**: `task-cli/package.json` — `bin` entry, no `engines` pin, `test` script.
