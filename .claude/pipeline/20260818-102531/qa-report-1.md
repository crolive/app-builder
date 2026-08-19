# QA Report — Task CLI — Attempt 1

## Verdict
**PASS**

## Acceptance Criteria Results

| Criteria | Result | Notes |
|---|---|---|
| `task add "<description>"` with a non-empty description creates a new task with a unique integer ID and `completed: false`, prints `Added task <id>: <description>`, and exits `0`. | PASS | Verified via `node:test` suite and manual global-binary run. |
| `task add` with no description argument, an empty string, or a whitespace-only string fails, prints an error to stderr, exits `1`, and does not add a task. | PASS | Verified all three cases manually and in tests. |
| Task IDs are assigned starting at `1` and increment by `1` for each successfully added task, regardless of deletions. | PASS | Verified: added 1,2,3; deleted 1; next add got ID 3 correctly reflecting `nextId` never decrements. |
| `task list` prints one line per existing task in ascending ID order, each showing the task's ID, completion status (`[x]` or `[ ]`), and description. | PASS | Exact format confirmed: `[ ] 1  Buy milk`, `[x] 2  Clean house`. |
| `task list` prints `No tasks found.` and exits `0` when the task list is empty. | PASS | Confirmed via test and first-run manual check. |
| `task list` never modifies `~/.task-cli/tasks.json`. | PASS | Test compares file bytes before/after `list`; `handleList` never calls `saveData`. |
| `task complete <id>` for an existing task's ID marks it `completed: true`, prints `Completed task <id>: <description>`, and exits `0`. | PASS | Verified manually and in tests. |
| `task complete <id>` for a non-integer ID fails, prints an error to stderr, exits `1`, and does not modify any task. | PASS | `Error: invalid task id "abc"` confirmed, no mutation. |
| `task complete <id>` for an integer ID with no matching task fails with a "not found" error to stderr, exits `1`, and does not modify any task. | PASS | `Error: task 99 not found` confirmed. |
| `task complete <id>` run twice on the same valid ID succeeds both times without error. | PASS | Confirmed idempotent, same confirmation message both times. |
| `task delete <id>` for an existing task's ID permanently removes it from the task list, prints `Deleted task <id>: <description>`, and exits `0`. | PASS | Verified. |
| `task delete <id>` for a non-integer ID fails, prints an error to stderr, exits `1`, and does not modify the task list. | PASS | Verified. |
| `task delete <id>` for an integer ID with no matching task fails with a "not found" error to stderr, exits `1`, and does not modify the task list. | PASS | Verified (deleting the same ID twice correctly fails the second time). |
| After `task delete <id>`, that ID is never reused by a subsequent `task add`. | PASS | Confirmed: `nextId` is never decremented on delete. |
| Data persists across separate process invocations: a task added in one `task add` invocation appears in a `task list` run as a separate, later invocation. | PASS | Verified via separate globally-linked binary invocations and in tests. |
| All task data is stored at `~/.task-cli/tasks.json` and nowhere else on disk. | PASS | `store.js` resolves the path exclusively via `os.homedir()`; no other file writes in codebase. |
| On first run (no existing `~/.task-cli` directory or `tasks.json` file), the tool creates them automatically instead of erroring, and behaves as if starting from an empty task list. | PASS | Confirmed directory/file auto-created with `{ nextId: 1, tasks: [] }`. |
| If `~/.task-cli/tasks.json` contains invalid JSON, every command fails with a "corrupted" error to stderr, exits `1`, and does not overwrite the existing file contents. | PASS | Confirmed file bytes unchanged (`{ not valid json`) after failed `list` run. Also independently verified for wrong-shape (valid JSON, invalid data model) files. |
| Running `task` with no subcommand, or with an unrecognized subcommand, prints a usage message to stderr and exits `1`. | PASS | Usage message lists all four subcommands; confirmed for both empty and `bogus` cases. |
| The codebase contains no HTTP client, `fetch`, or network socket usage anywhere (verifiable by source inspection). | PASS | Manual grep across `src/` and `bin/` for http/https/net/dgram/fetch/axios/request found nothing; also covered by an automated test. |
| The tool is invocable as a plain global command (`task ...`) after install, per the `bin` entry in `package.json`, not only via `node <file> ...`. | PASS | Verified via `npm link`, which installs shims (`task`, `task.cmd`, `task.ps1`) in the npm global bin dir; invoked the linked binary directly end-to-end for all commands with matching output. Unlinked afterward to leave no residue. |
| Argument parsing is implemented using Node's built-in `util.parseArgs`, with no third-party CLI parsing library present in dependencies. | PASS | `src/cli.js` uses `require('util').parseArgs`; `package.json` has no `dependencies` field and no `node_modules` third-party packages present. |
| Tests are implemented using Node's built-in `node:test` runner, with no third-party test framework present in dependencies. | PASS | `test/task.test.js` uses `node:test`/`node:assert`; `npm test` runs `node --test`; all 24 tests pass. |
| `package.json` does not pin a minimum Node version via `engines`. | PASS | No `engines` field present in `package.json`. |

## Critical Issues
None.

## Warnings
None.

## Suggestions
- **[SUGGESTION]** `parseTaskId` accepts negative integers (e.g. `-5`) as syntactically valid IDs, which then correctly fall through to the "not found" branch since no task ever has a negative ID. This matches the spec's literal wording ("must parse as a base-10 integer") and dev-summary's documented rationale, and produces correct externally-observable behavior, so it is not a defect — just worth noting for future maintainers who might expect `invalid task id` instead of `not found` for negative input. — `task-cli/src/cli.js:18-23`
- **[SUGGESTION]** `task add` silently ignores extra positional arguments after the first (e.g. `task add "desc" "extra"` only uses `"desc"`). This is a reasonable, spec-consistent choice (documented in dev-summary), but a future enhancement could emit a warning or error to help users catch unintended unquoted input. — `task-cli/src/cli.js:56-57`

## Known Gaps Noted
None listed in dev-summary.md.
