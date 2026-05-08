---
description: "Plan or adjust the feature's screen design in the active .pen file and capture screenshots/notes for the spec."
---

# Plan Feature Design in Pencil

Plan — or adjust — the screen design for the feature in a `.pen` file via the Pencil MCP **before** the feature specification is written, so the design becomes the primordial source for requirements, flows, and UI copy.

## User Input

```text
$ARGUMENTS
```

Treat `$ARGUMENTS` as the feature description. If empty, fall back to the triggering message.

## Prerequisites

- Verify the **Pencil MCP** is available. If the `mcp__pencil__*` tools are not exposed in the current tool list, output:
  `[specify] Warning: Pencil MCP not available; skipped design planning`
  …and return without error so `/speckit-specify` can continue.

## Configuration

Read configuration in this order (first match wins):

1. `.specify/extensions/pencil/pencil-config.yml`
2. Defaults from `.specify/extensions/pencil/extension.yml` under `config.defaults`
3. Hard defaults: `pen_file: layout.pen`, `design_dir: design`, `screenshot_format: png`, `screens_per_feature: auto`, `viewports: { phone: 390x844, tablet: 820x1180 }`

The `viewports` key is **mandatory** — it defines the form factors every
logical screen must be designed for (constitution §5 UX5). Each logical
screen expands into ONE Pencil frame per configured viewport.

## Resolve Feature Directory

1. Read `.specify/feature.json` if it exists and extract `feature_directory`.
2. If `.specify/feature.json` does not yet exist (the user invoked this command before `/speckit-specify` created it):
   - Determine the current git branch with `git rev-parse --abbrev-ref HEAD`.
   - If the branch name matches `NNN-<short-name>` or `YYYYMMDD-HHMMSS-<short-name>`, assume the feature directory will be `specs/<branch-name>` and create it with `mkdir -p`.
   - Otherwise, abort with a message asking the user to run `/speckit-specify` (or the `speckit.git.feature` hook) first.
3. Set `FEATURE_DIR` to the resolved path.
4. Create `FEATURE_DIR/<design_dir>/` (`mkdir -p`).

## Execution Flow

1. **Open the .pen file**
   - Call `mcp__pencil__get_editor_state({ include_schema: true })`.
   - If the currently active editor's path does not match `pen_file` from config, call `mcp__pencil__open_document({ filePathOrNew: "<pen_file>" })`. If the configured `pen_file` does not exist on disk, pass `"new"` instead and record the created path.

2. **Apply the project style guide** (if the `style_guide` key exists in config):
   - Call `mcp__pencil__get_guidelines({ category: "style" })` to list Pencil's built-in style guides.
   - For each axis of the configured `style_guide` (`name`, `typography.*`, `color_palette`, `roundness`, `elevation`, `decorative_imagery`), load the matching guide via `mcp__pencil__get_guidelines({ category: "style", name: "<value>" })`. If the exact value has no match, pick the closest available and note the substitution in `screens.md` under "Design decisions".
   - Treat the loaded style guide as a **hard constraint** for every subsequent `batch_design` operation:
     - Use the specified font families for their respective text roles (`headings`, `body`, `captions`).
     - Use the configured color palette — prefer variables (`$` prefix) over hard-coded hex values so a future palette swap is cheap.
     - Apply the declared `roundness` to `cornerRadius` across shapes and the declared `elevation` to shadow effects uniformly.
     - Use `decorative_imagery` as the aesthetic for hero/illustrative elements (backgrounds, onboarding, empty states) — generate via `G(nodeId, "ai", "<prompt>")` referencing the imagery style.
   - Promote the palette, roundness, and elevation into the file's `variables` block on the first run of the hook so later features reuse them by reference instead of duplicating values.

3. **Identify candidate logical screens** for the feature (based on `screens_per_feature` config):
   - `auto`: Scan top-level frames from `get_editor_state` output. Group frames that share a logical screen name (ignoring a trailing `-phone` / `-tablet` suffix) and match those groups against feature keywords extracted from `$ARGUMENTS`. Pick the matches; if none match, propose creating new placeholder groups.
   - `ask`: List logical screens (grouped by base name across viewports) and wait for the user to choose which to adjust or extend.
   - `all`: Use every logical screen touched during the session.

   A **logical screen** is the user-visible concept (e.g., "Catalog home"). Each logical screen MUST exist as one frame **per configured viewport** — so with the default `viewports` (phone + tablet) each logical screen corresponds to TWO Pencil frames named `<screen-slug>-phone` and `<screen-slug>-tablet`.

4. **Plan the design** — iterate once per logical screen × viewport pair:
   - For each viewport in `viewports` (start with `phone`, then `tablet`):
     - Resolve the frame named `<screen-slug>-<viewport>`; create it at the viewport's declared `width` × `height` if missing.
     - Decide whether to:
       - **Adjust** an existing frame — set `placeholder: true` before edits, use `batch_design` operations, unset `placeholder` when finished.
       - **Create** a new frame — start with `placeholder: true` at the exact viewport dimensions, build with components from the existing design system (reusable components discovered via `batch_get`), finalize.
   - **Tablet ≠ stretched phone.** The tablet layout MUST take advantage of the extra canvas where it meaningfully helps the user (split views, multi-column grids, side panels, denser cards). If the feature's interaction truly does not benefit from the larger canvas, document that decision under "Design decisions" in `screens.md` — do not silently duplicate the phone frame.
   - Follow the Pencil general instructions that were loaded via `get_editor_state(include_schema: true)`: keep each `batch_design` call to ≤25 operations, prefer existing reusable components, use flexbox over absolute positioning, etc.
   - Every shape, text, and component instance MUST conform to the style guide applied in step 2 — fonts, colors, corner radius, shadow. Inconsistencies are tracked as "Open questions for the spec".

5. **Export screenshots**
   - For every frame finalized in this session (one per logical screen × viewport), call `mcp__pencil__export_nodes` (or `mcp__pencil__get_screenshot` as fallback) and write the output to `FEATURE_DIR/<design_dir>/<screen-slug>-<viewport>.<screenshot_format>`.
   - Use the logical screen name (lowercased, dash-separated) as `<screen-slug>` and the viewport key (`phone`, `tablet`) as `<viewport>`.

6. **Write a design summary** to `FEATURE_DIR/<design_dir>/screens.md` with this structure:

   ```markdown
   # UI Design — <feature short name>

   **Source**: [<pen_file>](../../../<pen_file>)
   **Captured**: <YYYY-MM-DD>
   **Viewports**: Phone (390×844 pt), Tablet (820×1180 pt) — portrait only

   ## Screens

   | Screen | Phone frame | Phone shot | Tablet frame | Tablet shot | Notes |
   |--------|-------------|------------|--------------|-------------|-------|
   | <Screen name> | `<phone-frame-id>` | [<slug>-phone.png](./<slug>-phone.png) | `<tablet-frame-id>` | [<slug>-tablet.png](./<slug>-tablet.png) | <1-line intent + how tablet differs from phone> |

   ## Components referenced

   - `<component-id>` — <component name>

   ## Design decisions

   - <One bullet per non-obvious choice made during the session (layout, flow, copy, empty states).>
   - <For each screen, one bullet on the phone→tablet delta: split view? multi-column grid? side panel? "same layout, scaled" is only acceptable with a stated reason.>

   ## Open questions for the spec

   - <Any [NEEDS CLARIFICATION] items the designer could not resolve — will be promoted into spec.md.>
   ```

7. **Emit a pointer file** at `FEATURE_DIR/design.json` so downstream skills (`/speckit-plan`, `/speckit-tasks`, `/speckit-implement`) can locate the design artifacts. Each logical screen lists one entry per configured viewport:

   ```json
   {
     "pen_file": "<pen_file>",
     "design_dir": "<feature_dir>/<design_dir>",
     "viewports": ["phone", "tablet"],
     "screens": [
       {
         "name": "<screen name>",
         "slug": "<screen-slug>",
         "variants": [
           { "viewport": "phone",  "frame_id": "<id>", "screenshot": "<slug>-phone.png"  },
           { "viewport": "tablet", "frame_id": "<id>", "screenshot": "<slug>-tablet.png" }
         ]
       }
     ]
   }
   ```

## Output

Return JSON-shaped text (so `/speckit-specify` can parse it if needed):

```
DESIGN_DIR=<feature_dir>/<design_dir>
SCREENS_MD=<feature_dir>/<design_dir>/screens.md
PEN_FILE=<pen_file>
SCREENS_COUNT=<n>            # number of logical screens
VIEWPORTS=phone,tablet       # from config; comma-separated
FRAMES_COUNT=<n×viewports>   # total frames exported
```

## Graceful Degradation

- Pencil MCP missing → warn and exit 0 so the specify flow continues without design.
- `.pen` file missing and `mcp__pencil__open_document("new")` fails → warn and exit 0.
- User declines the optional hook prompt → skip silently.

## Notes for `/speckit-specify` integration

When the spec is generated immediately after this command, the specify skill **MUST** include a `## UI Design` section in `spec.md` that:
- Links to `<design_dir>/screens.md`
- Lists the screens (with phone AND tablet image links side by side) as the primordial design source
- Derives user stories from the screens and interactions captured in the design summary
- Calls out any phone→tablet layout deltas that carry functional implications (e.g., "tablet shows a persistent side panel, so the navigation requirement differs")

## Notes for `/speckit-plan` and `/speckit-implement` integration

Downstream commands MUST honor constitution §5 UX5:

- `plan.md` "Structure Decision" MUST describe the responsive approach — e.g., viewport hook (`useWindowDimensions`), shared components with viewport-conditional layout sub-trees, breakpoint thresholds — whenever the feature introduces new screens.
- `tasks.md` MUST include, for each screen task, a "verify on tablet simulator" acceptance check in addition to the phone check. A screen task is NOT complete if it has only been verified on one form factor.
