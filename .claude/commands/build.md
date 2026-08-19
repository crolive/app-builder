# /build

Orchestrates a full idea-to-shipped-code pipeline for new projects. Runs one stage at a time, pausing for user approval at each handoff.

## Setup

1. Generate a run ID using the current timestamp (format: `YYYYMMDD-HHmmss`).
2. Create the run directory: `.claude/pipeline/<run-id>/`
3. If the user provided an idea as an argument to `/build`, use it as the starting context. If not, ask: "What would you like to build?"

---

## Stage 1 — Requirements Gathering

Ask the user the following questions one at a time in a conversational way. Do not dump all questions at once. Use the user's previous answers to inform how you ask the next ones (e.g. if they've already mentioned the tech stack in the idea, skip or confirm question 4).

**Questions:**
1. What is the project name?
2. What should this project do? Describe the idea and the problem it solves.
3. Who is it for, and what is the primary use case?
4. Tech stack — language, runtime, frameworks, key libraries. ("No preference" is valid and will be flagged in planning.)
5. What are the key features it must have?
6. What should it explicitly NOT include?
7. Are there any hard constraints? (e.g. must run offline, no external APIs, specific performance requirements)

Once all questions are answered, write `.claude/pipeline/<run-id>/requirements.md` with a clean summary of the answers. Structure it clearly with labeled sections matching each question.

---

## Stage 2 — Planning

Run the `pipeline-planner` subagent. In the subagent prompt, include:
- The full contents of `requirements.md`
- This exact instruction: **"Write your output to `.claude/pipeline/<run-id>/plan.md`. Do not write to any other location."**
- Any resolved gap answers if this is a re-run.

### After the subagent completes

Verify that `.claude/pipeline/<run-id>/plan.md` exists. If it does not exist, re-run the subagent with a reminder that it must write the file to that exact path before finishing.

### Risks & Assumptions resolution loop

Check `plan.md` for any `[GAP]` items in the Risks & Assumptions section.

If there are `[GAP]` items:
- Tell the user: "The planner needs a few things clarified before it can proceed."
- Present each `[GAP]` item clearly and collect the user's answer for each one.
- Re-run the `pipeline-planner` subagent with the original `requirements.md` plus the resolved answers appended.
- Repeat until no `[GAP]` items remain.

### Plan approval gate

Show the user a brief summary:
- What the project is
- What's in scope (feature count and brief list)
- What technical decisions were made
- Any `[ASSUMPTION]` or `[RISK]` items to be aware of

Then give the path to the full plan: `.claude/pipeline/<run-id>/plan.md`

Ask the user to choose:
- **Approve** — proceed to spec writing
- **Edit** — user edits `plan.md` directly, then confirms they are done
- **Reject** — stop the pipeline

Do not proceed until the user explicitly approves.

---

## Stage 3 — Spec Writing

Run the `pipeline-spec-writer` subagent. In the subagent prompt, include:
- The full contents of `plan.md`
- This exact instruction: **"Write your output to `.claude/pipeline/<run-id>/spec.md`. Do not write to any other location."**

### After the subagent completes

Verify that `.claude/pipeline/<run-id>/spec.md` exists. If it does not exist, re-run the subagent with a reminder that it must write the file to that exact path before finishing.

### Spec approval gate

Show the user a brief summary:
- Number of features defined
- Number of acceptance criteria
- Tech stack and key constraints
- Any notable decisions captured in Open Questions Resolved

Then give the path to the full spec: `.claude/pipeline/<run-id>/spec.md`

Ask the user to choose:
- **Approve** — copy spec to `docs/specs/<project-name>.md` and proceed to development
- **Edit** — user edits `spec.md` directly, then confirms they are done. Copy the edited version to `docs/specs/<project-name>.md` before proceeding.
- **Reject** — stop the pipeline

Do not proceed until the user explicitly approves.

---

## Stage 4 — Development

Track a `dev_attempt` counter starting at 1.

Run the `pipeline-developer` subagent. In the subagent prompt, include:
- The full contents of `spec.md`
- The QA report from the previous attempt if this is a re-run (include full contents)
- These exact instructions:
  - **"Write all project code to `<project-dir>/`."**
  - **"Write your dev-summary.md to `.claude/pipeline/<run-id>/dev-summary.md`. This is required. It must be the last thing you do before finishing."**

### After the subagent completes

1. Check for `.claude/pipeline/<run-id>/spec-issue.md`. If it exists:
   - Tell the user: "The developer encountered a problem with the spec that needs to be resolved before building can continue."
   - Show the contents of `spec-issue.md`
   - Ask the user how they'd like to proceed: edit the spec and re-run development, or stop the pipeline.
   - Do not auto-proceed.

2. Verify that `.claude/pipeline/<run-id>/dev-summary.md` exists. If it does not:
   - Re-run the subagent with this instruction: "The code was written but dev-summary.md was not produced. Write dev-summary.md to `.claude/pipeline/<run-id>/dev-summary.md` now. Do not modify any code."

### Dev approval gate

Show the user a brief summary:
- What was built (mapped to spec features)
- Any deviations from the spec
- Any known gaps

Then give the path to the full summary: `.claude/pipeline/<run-id>/dev-summary.md`

Ask the user to choose:
- **Approve** — proceed to QA
- **Edit** — user provides direction, re-run the developer subagent with the original spec plus the user's notes (increment `dev_attempt`)
- **Reject** — stop the pipeline

Do not proceed until the user explicitly approves.

---

## Stage 5 — QA

Track a `qa_attempt` counter starting at 1.

Run the `pipeline-qa-reviewer` subagent. In the subagent prompt, include:
- The full contents of `spec.md`
- The full contents of `dev-summary.md`
- The location of the project code
- These exact instructions:
  - **"Write your QA report to `.claude/pipeline/<run-id>/qa-report-<qa_attempt>.md`. This is required. It must be the last thing you do before finishing."**
  - **"Run the project code freely to test acceptance criteria. You have full permission to execute commands, delete test state, and read any file. Do not ask for permission and do not modify settings files."**

### After the subagent completes

Verify that `.claude/pipeline/<run-id>/qa-report-<qa_attempt>.md` exists. If it does not:
- Re-run the subagent with this instruction: "You ran tests but did not write the QA report. Write the QA report to `.claude/pipeline/<run-id>/qa-report-<qa_attempt>.md` now based on your findings. Do not re-run tests."

### Route by verdict

Read the Verdict line from the QA report.

**FAIL** (critical issues found):
- Show the user a brief summary of the critical issues found.
- Give the path to the full report: `.claude/pipeline/<run-id>/qa-report-<qa_attempt>.md`
- If `qa_attempt` < 3:
  - Increment `qa_attempt` and `dev_attempt`.
  - Automatically re-run Stage 4 (developer) with the QA report as additional input.
  - Then re-run Stage 5 (QA). Repeat from the verdict check.
- If `qa_attempt` == 3:
  - Tell the user: "The pipeline has failed QA 3 times. Here's a summary of what's been attempted."
  - Show a summary of all QA reports.
  - Ask the user how they'd like to proceed: provide direction and retry, edit the spec and restart development, or stop the pipeline.

**PASS WITH WARNINGS**:
- Show the user the warnings and what decision each one requires.
- Give the path to the full report: `.claude/pipeline/<run-id>/qa-report-<qa_attempt>.md`
- Ask the user to resolve each warning and choose a path forward.
- If the user wants fixes applied: re-run Stage 4 (developer) with the warnings as input, then re-run Stage 5 (QA).
- If the user accepts all warnings as-is: proceed to completion.

**PASS**:
- Tell the user the build passed QA.
- If there are suggestions, show them: "The QA reviewer had a few suggestions — no action required, but worth considering."
- Proceed to completion.

---

## Completion

Tell the user:
- The pipeline completed successfully.
- Where the final spec lives: `docs/specs/<project-name>.md`
- Where the pipeline artifacts live: `.claude/pipeline/<run-id>/`
- A one-sentence summary of what was built.
