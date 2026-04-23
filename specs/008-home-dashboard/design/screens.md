# UI Design — Home Dashboard & Empty States

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-23

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| Home / Phone (populated) | `XmxN2` | [home-phone.png](./home-phone.png) | Returning user — synced state, 3 quick-action cards, last sent order in recent activity. |
| HomeEmpty / Phone | `yHNTP` | [home-empty-phone.png](./home-empty-phone.png) | First run — syncing pill, empty catalog/clients/drafts with salesperson-language CTAs. |
| Home / Tablet (populated) | `czxzV` | [home-tablet.png](./home-tablet.png) | Same content as phone in a 2-column quick-action grid; recent activity expanded. |
| HomeEmpty / Tablet | `IvIBz` | [home-empty-tablet.png](./home-empty-tablet.png) | 3-column empty state; matches phone copy strategy. |

## Components referenced

Home screens are built from primitives (frames, icons, text) styled to match existing ClientList screens. No existing reusable component instances are used yet — the card/pill/badge patterns here SHOULD be promoted to reusable components when the feature is implemented (planned as an open question).

Key primitives reused visually:

- Top bar pattern from `ol4CQ` (ClientList / Phone) — 56h white, 1px bottom border `#E4E4E7`, title "Inter 18/600".
- Sync pill — green success variant (`#F0FDF4` / `#BBF7D0` / dot `#16A34A`) and amber in-progress variant (`#FFFBEB` / `#FDE68A` / dot `#D97706`).
- Quick-action card — 84h (phone) / 104h (tablet), icon wrap 44/52, cornerRadius 12/14, border `#E4E4E7`.

## Design decisions

- **Sync status is inline only** — a pill in the top bar. No modal, no alert, no toast. The amber "Sincronizando…" variant replaces the green pill while a sync is in flight (UX4: no blocking spinner).
- **Empty states speak in the salesperson's voice.** Copy is task-oriented: "Seu catálogo ainda está vazio", "Cadastre sua primeira loja", "Nenhum rascunho por enquanto" — never "no data" or error language.
- **Every empty state points to the next step.** Catalog → "Sincronizar agora" (primary CTA). Clients → "Nova loja" (outline CTA). Drafts → no CTA, because drafts are created as a side-effect of adding items in the catalog; the copy explains that.
- **Drafts card surfaces a count badge.** Drafts are the only quick action with transient state, and the badge reinforces that there is unsent work.
- **Recent activity shows exactly one item.** Per UX3 (home as hub, not a feed), we surface the last sent order only. In the empty state it is a dashed-border placeholder with the same slot shape.
- **Tablet is a layout-only variant.** Quick actions become a 2×2 grid (with the third cell occupied by the drafts card and a neutral spacer keeping the grid balanced). Copy is identical. No landscape.
- **Palette sticks with the existing neutral/zinc system already in `layout.pen`** (background `#FAFAFA`, card `#FFFFFF`, border `#E4E4E7`, text `#0A0A0A` / muted `#71717A`). The style guide in `pencil-config.yml` lists "Lavender Cream / Fluid Ribbon Gradients"; none of the other shipped screens (`ClientList`, `Login`, `Lock`, `PinSetup`) follow that direction, so the Home screens match the shipped system instead of introducing a second visual language. Promoting the pill/card/badge patterns to reusable components and re-evaluating the project-wide palette is an open question tracked below.

## ConfirmModal primitive (infrastructure spillover)

Introduced as a cross-cutting primitive while scoping 008 because the spec's FR-005 ("no modal/alert/toast/spinner for sync") cannot be enforced as long as the app uses the OS `Alert.alert` anywhere. Two frames ship as the canonical design reference; the primitive itself lives at `src/app/ui/modal/` and is reusable across features.

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| ConfirmModal / Phone | `zwiuM` | [confirm-modal-phone.png](./modals/confirm-modal-phone.png) | Destructive-confirm variant (logout as canonical instance). Dimmed backdrop `#09090B99`; white card 324 pt wide, corner radius 16, shadow `(0,8, 24)`; title 18/700 + body 13/400 muted + two buttons (outline "Cancelar" / destructive `#DC2626` "Sair"). |
| ConfirmModal / Tablet | `Lasp4` | [confirm-modal-tablet.png](./modals/confirm-modal-tablet.png) | Same content in a wider 480 pt card, larger padding (32) and type (22/700 title, 15/400 body). Buttons right-aligned (`fit_content`), consistent with desktop-dialog convention. |

### Modal design decisions

- **Single component covers confirm + info.** The canonical instance shows two buttons (destructive variant); the single-button info variant is the same component with `cancelLabel = undefined` (info mode hides the cancel slot and left-aligns the primary).
- **No system-native alerts anywhere.** Both existing `Alert.alert` call sites (HomePlaceholderScreen logout, CatalogScreen "Sem internet") are migrated: logout uses ConfirmModal; Catalog's offline notice is DELETED — the inline sync pill carries the "Sem conexão" signal per constitution UX4.
- **Destructive variant = red fill `#DC2626`.** Matches the drafts badge; consistent visual language for "careful, this is destructive."
- **Backdrop is a tap-to-dismiss overlay.** Tapping the dim area closes the modal as if the user tapped Cancel (destructive) or the primary (info — since there's no cancel to match).
- **No Pencil `Modal/Center` component reused.** The pre-existing `C:X6bmd` component carries a different visual weight (bigger elevation, different type stack) than the rest of the shipped neutral/zinc screens. Drawing fresh keeps the app visually cohesive.

## Open questions for the spec

- Should sync-pill states include a third "offline" variant (e.g. dashed gray with a cloud-off icon), or is "Sincronizando…" the only non-success state for v1?
- The drafts card has no CTA in the empty state — should tapping the empty card deep-link to the catalog instead of being a no-op?
- Should "Atividade recente" grow to N items later, or is the single-last-sent-order constraint a durable part of the hub model?
