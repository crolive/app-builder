# `/build` — Claude Code Development Pipeline

## Overview

A Claude Code slash command (`/build`) that orchestrates a full "idea → shipped code" pipeline, running one stage at a time and handing off documents between stages. Initial version targets **new projects**; designed so it can later be adapted into a **feature-development pipeline** for existing projects.

## Pipeline Flow

```
/build "<idea>"
  │
  ├─ [Main thread] Ask clarifying questions interactively
  │     → writes requirements.md
  │
  ├─ [Subagent: planner] reads requirements.md → writes plan.md
  │     → PAUSE: show plan, wait for approval/edits
  │
  ├─ [Subagent: spec-writer] reads plan.md → writes spec.md → copies to docs/specs/
  │     → PAUSE: show spec, wait for approval/edits
  │
  ├─ [Subagent: developer] reads spec.md → implements → writes dev-summary.md
  │     → PAUSE: show summary, wait for approval to proceed to QA
  │
  ├─ [Subagent: qa-reviewer] reads spec.md + diff/code → writes qa-report-N.md
  │     ├─ PASS → PAUSE: show report, done
  │     └─ FAIL → auto-loop back to developer with qa-report-N.md as input
  │           (attempt counter in state.json; after 3 failed attempts,
  │            stop and ask user how to proceed)
```

## Key Decisions

| Decision | Choice |
|---|---|
| Approval gates | Pause for user approval at **every** handoff (after plan, after spec, after dev, after QA) |
| QA failure handling | Auto-loop back to developer with QA notes; **cap at 3 attempts**, then stop and ask the user |
| Execution model | Separate **subagents** (Claude Code Task tool) per stage, orchestrated by one main command |
| Command name | `/build` |
| Question-asking | Happens in the **main thread**, not a subagent — subagents run in isolated context and return a final result, so they're not well-suited to live back-and-forth. The orchestrator asks the user directly, then passes answers into each subagent's context. |

## Storage Layout (hybrid approach)

- **`.claude/pipeline/<run-id>/`** — working/transient pipeline files (gitignore-able):
  - `requirements.md`
  - `plan.md`
  - `state.json`
  - `qa-report-1.md`, `qa-report-2.md`, ...
- **`docs/specs/<project-name>.md`** — the final **approved** spec is copied here once approved, becoming a durable artifact. This is what the future feature pipeline will read/extend.

### File tree

```
.claude/
  commands/
    build.md              ← the /build orchestrator command
  agents/
    pipeline-planner.md
    pipeline-spec-writer.md
    pipeline-developer.md
    pipeline-qa-reviewer.md
  pipeline/
    <run-id>/
      requirements.md
      plan.md
      spec.md
      state.json
      qa-report-1.md ...
docs/
  specs/
    <project-name>.md
```

## `state.json` — purpose

Tracks pipeline state so it can resume if interrupted, and enforces the QA retry cap:
- current stage
- run-id
- attempt count (for QA loop)
- paths to each handoff doc
- approval status per stage

## Extensibility: Future Feature-Development Pipeline

Keep the stage sequence generic (`requirements → plan → spec → dev → qa`) with **pluggable subagent prompts**, so a future `/feature` command can reuse the same orchestrator logic and only swap what each subagent does:
- **Planner**: reads existing codebase context instead of starting from a blank slate
- **Spec-writer**: references and extends the existing file in `docs/specs/` rather than creating a new one from scratch

Avoid hardcoding "new project" assumptions into the orchestrator's stage logic now, so this extension is a matter of adding new subagent definitions rather than rewriting the command.

## Next Steps

1. Build the `/build` orchestrator command (`.claude/commands/build.md`)
2. Build the four subagents:
   - `pipeline-planner.md`
   - `pipeline-spec-writer.md`
   - `pipeline-developer.md`
   - `pipeline-qa-reviewer.md`
3. Wire up `state.json` tracking and the QA retry loop
4. Test end-to-end on a small sample project
5. Later: adapt into `/feature` pipeline for existing projects
