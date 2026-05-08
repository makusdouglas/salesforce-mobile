---
name: "speckit-auto"
description: "Run the full spec-kit workflow end-to-end (specify → clarify → pencil-design → plan → tasks → analyze → implement), pausing only when human input is strictly required."
argument-hint: "Describe the feature, or pass 'resume' to continue from the current phase"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "markus"
  source: "custom orchestrator over github-spec-kit"
user-invocable: true
disable-model-invocation: false
---


## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is empty, ERROR: "Provide a feature description (or `resume` to continue an in-flight feature)."

## What this skill does

Runs the spec-kit workflow **autonomously** by chaining the existing step skills. Each step is a real skill invocation — do not simulate them, do not summarise their outputs in place of running them.

## Pre-Execution Checks

1. Confirm the project is spec-kit ready:
   - `.specify/` directory exists at the repo root
   - `.specify/templates/spec-template.md` exists
   - If either is missing, ERROR and tell the user to run spec-kit init first.

2. Detect mode:
   - If `$ARGUMENTS` starts with `resume` (case-insensitive) **or** `.specify/feature.json` points to an in-flight directory that is missing later artifacts, switch to **resume mode** (skip phases whose output already exists).
   - Otherwise, treat the whole `$ARGUMENTS` as the feature description for a fresh run.

3. Load the active feature directory:
   - If `.specify/feature.json` exists and is valid JSON, read `feature_directory` from it.
   - Otherwise it will be set by the `speckit-specify` step.

## Phase Plan

Run phases in this exact order. After each phase, check the "Skip if" condition: if the artifact already exists **and** we are in resume mode, skip that phase. Otherwise always run it.

| # | Phase                    | Skill to invoke          | Produces                                                | Skip if (resume mode)                        |
|---|--------------------------|--------------------------|---------------------------------------------------------|----------------------------------------------|
| 1 | Specify                  | `speckit-specify`        | `specs/<slug>/spec.md` + `.specify/feature.json`        | `spec.md` exists                             |
| 2 | Clarify (conditional)    | `speckit-clarify`        | updated `spec.md` (NEEDS CLARIFICATION resolved)        | no `[NEEDS CLARIFICATION]` markers in spec   |
| 3 | Pencil design            | `speckit-pencil-design`  | updated `layout.pen` + design exports/notes in feature  | `design/` or `design.json` exists in feature |
| 4 | Plan                     | `speckit-plan`           | `plan.md`, `research.md`, `data-model.md`, `contracts/` | `plan.md` exists                             |
| 5 | Tasks                    | `speckit-tasks`          | `tasks.md`                                              | `tasks.md` exists                            |
| 6 | Analyze (quality gate)   | `speckit-analyze`        | consistency report; may mutate spec/plan/tasks          | never skip — cheap and catches drift         |
| 7 | Implement                | `speckit-implement`      | code changes checking off `tasks.md`                    | all tasks already checked off                |

> Phase 7 inherits the **Pencil MCP Design Gate** declared inside `speckit-implement`: if the feature has UI tasks and the Pencil MCP is not live, implement will checkpoint `layout.pen`, ask for a Pencil restart, and hard-pause if it still can't connect. Do not try to bypass that gate from here.

## Execution Rules

- **Invoke each skill as a real step.** When it is time to run phase N, invoke the corresponding Skill tool with the arguments from this orchestrator — do not write the output by hand.
- **Stop for humans only when necessary**: the only hard stop points are (a) `speckit-clarify` surfacing questions that require user answers, (b) `speckit-analyze` reporting critical issues, or (c) a step itself asking for user input. On a stop, print a one-line "Paused at phase X: <reason>. Reply with answers or `/speckit-auto resume` to continue." and end the turn.
- **No hook evaluation here.** Each step skill already handles its own `before_*` / `after_*` hooks from `.specify/extensions.yml`. Trust them.
- **Argument forwarding**:
  - Phase 1 (`specify`): forward the full `$ARGUMENTS` (minus a leading `resume` token, if present).
  - Phase 2 (`clarify`): no arguments.
  - Phase 3 (`pencil-design`): no arguments unless the user passed explicit design hints in `$ARGUMENTS` after a `--design` marker.
  - Phases 4–7: no arguments unless the user passed explicit phase-scoped hints (e.g., `--plan "use WatermelonDB"`). If no hints, run with empty arguments.
- **Never skip Analyze.** Even in resume mode, re-run it before Implement so spec/plan/tasks drift is surfaced.
- **Fail-fast on errors.** If any phase returns an error, print:
  ```
  speckit-auto halted at phase <N:name>
  Reason: <error>
  Artifacts so far: <feature_directory>
  Resume with: /speckit-auto resume
  ```
  and end the turn. Do **not** try to recover creatively.

## Output Format

At the end of a successful run, report:

```
✅ speckit-auto complete
Feature: <feature_directory>
Spec:    <spec.md path>
Plan:    <plan.md path>
Tasks:   <N> done / <M> total
Changes: <short summary of code changes made by implement>
Next:    open a PR (/create-pr or manual)
```

On a paused run, report:

```
⏸ speckit-auto paused at phase <N:name>
Reason: <why>
To continue: answer above, then run `/speckit-auto resume`
```

## Non-Goals

- This skill does **not** create git branches, commits, or PRs. Use `/speckit-git-feature`, `/speckit-git-commit`, or `/create-pr` separately — they compose cleanly with this flow.
- This skill does **not** bypass the Constitution Check in the plan phase; it just runs the same `speckit-plan` skill that already enforces it.
- This skill does **not** invent new phases. If you want a step the step skills don't already provide, add a new `speckit-*` skill first and then extend the table above.
