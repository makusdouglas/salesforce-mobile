# Pencil Design Planning extension

Adds a `before_specify` hook that plans (or adjusts) the feature's screen design in a `.pen` file — through the [Pencil MCP](https://www.trypencil.com) — before `spec.md` is written, so the design becomes the primordial source for the specification.

## What it does

When you run `/speckit-specify "..."`, the specify skill detects the `before_specify` hook registered in `.specify/extensions.yml` and offers to run `/speckit-pencil-design` first. That command:

1. Opens the project's `.pen` file through the Pencil MCP.
2. Identifies candidate screens for the feature (or creates new placeholder frames).
3. Lets you plan / adjust the layout using Pencil's reusable components.
4. Exports screenshots and a `screens.md` summary into `specs/<feature>/design/`.
5. Writes a `design.json` pointer so downstream skills (`plan`, `tasks`, `implement`) can reference the design.

The spec template's **UI Design** section then points to those artifacts, and user stories are derived from the planned screens.

## Configuration

See `config-template.yml`. Copy it to `pencil-config.yml` in the same directory to override defaults. The main knob is `pen_file` — the path of the `.pen` file this project uses (default `layout.pen`).

## Opting out per feature

The hook is registered with `optional: true`. For backend-only features, simply decline the prompt when `/speckit-specify` asks.

## Disabling entirely

Set `enabled: false` under `hooks.before_specify.pencil` in `.specify/extensions.yml`, or remove that entry.
