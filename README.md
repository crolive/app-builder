# app-builder

A Claude Code project for building small CLI apps end-to-end via an automated `/build` pipeline, plus the sample apps it has produced.

## Contents

- **`.claude/commands/build.md`** — the `/build` slash command: orchestrates a full idea → shipped code pipeline (requirements → plan → spec → dev → QA), pausing for user approval at each handoff. See [`build-pipeline-plan.md`](build-pipeline-plan.md) for the design decisions behind it.
- **`.claude/agents/`** — the four subagents `/build` invokes in sequence: `pipeline-planner`, `pipeline-spec-writer`, `pipeline-developer`, `pipeline-qa-reviewer`.
- **`.claude/pipeline/<run-id>/`** — transient working files from each pipeline run (`requirements.md`, `plan.md`, `spec.md`, `state.json`, `qa-report-N.md`).
- **`docs/specs/`** — durable, approved specs copied here once a pipeline run completes (`task-cli.md`, `todo-tracker.md`).
- **`task-cli/`** — sample app: a terminal task manager using Node's built-in `util.parseArgs` and a local JSON file, with zero third-party dependencies.
- **`todo-tracker/`** — sample app: a terminal task manager built with `commander`, storing tasks in `~/.todo-tracker/tasks.json`.

## The `/build` Pipeline

```
/build "<idea>"
  ├─ Requirements gathering (main thread, asks the user)   → requirements.md
  ├─ Planning (pipeline-planner subagent)                  → plan.md
  ├─ Spec writing (pipeline-spec-writer subagent)           → spec.md
  ├─ Development (pipeline-developer subagent)              → dev-summary.md
  └─ QA review (pipeline-qa-reviewer subagent)               → qa-report-N.md
```

Each stage pauses for user approval before continuing. A failing QA review loops back to development (capped at 3 attempts) before asking the user how to proceed.

## Sample Apps

Both `task-cli` and `todo-tracker` are simple, offline, single-user CLI task managers produced by running the pipeline — same problem, different tech-stack constraints, useful as a comparison of pipeline output.
