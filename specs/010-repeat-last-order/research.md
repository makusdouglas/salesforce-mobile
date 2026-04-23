# Phase 0 Research — Repeat Past Order

**Date**: 2026-04-23
**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

All Technical Context entries in `plan.md` were resolvable without clarification — no `NEEDS CLARIFICATION` markers. This document captures the five decisions that required investigation, the rationale, and the alternatives rejected.

---

## R-001 — Pricing policy at clone time

**Decision**: Resolve each cloned line's `unit_price` from the **current** `product_variants.price` at the moment `repeat` runs. Do not copy the historical `unit_price` from the source order's line.

**Rationale**:

- The spec's Assumptions section records "current catalog prices are authoritative" and SC-003 demands zero silent drift from the catalog. Freezing historical prices would create a long-term divergence where a draft cloned from a year-old order could ship with a stale price the salesperson never noticed.
- `product_variants.price` is already the single source of truth for new orders in 009. Using the same read path keeps the two entry points (new blank order vs. repeat) producing identical draft structures for identical selections.
- Line-level manual discounts are copied verbatim (FR-004), so the salesperson's intent ("I gave this client 10% off") is preserved on top of whatever current price applies. This gives the intuitively correct behaviour: "same deal, today's prices".

**Alternatives considered**:

- **Freeze historical price (copy `unit_price` from source line)**. Rejected because it lets stale prices leak into fresh orders and would force the salesperson to notice and manually refresh each line — the opposite of the tap-minimising intent of this feature.
- **Offer a per-line choice at clone time**. Rejected because it violates the ≤ 2-tap ceiling (UX2) and adds a modal the feature is explicitly forbidden from introducing.

---

## R-002 — Unavailable-item handling

**Decision**: Drop lines whose variant (or its parent product) is soft-deleted, and surface the drop via a non-dismissable notice on `OrderSummaryScreen` listing the dropped product names. If every line drops, block the clone entirely and present an inline message on `ClientProfileScreen` instead.

**Rationale**:

- Silent drops violate FR-007 and erode trust; blocking on a single missing item violates FR-008's partial-success intent. A visible notice is the only option that keeps the draft useful *and* honest.
- The notice is inline (not a modal) so the tap-budget is preserved — the salesperson still lands on the summary in 1 tap, just with a banner visible.
- The all-unavailable block lives on `ClientProfileScreen`, not on an empty summary, because a summary with zero lines would be confusing and would require a deletion step to back out. Keeping the user on the profile until there's something real to show is simpler.

**Alternatives considered**:

- **Soft-insert deleted items with a "unavailable" badge on the summary**. Rejected because the line has no price (the variant row may be gone) and the send flow would need a branch for "hidden" lines — creating a new invalid state on the summary. Simpler to drop + notify.
- **Block any repeat that has even one missing item**. Rejected because typical product churn means one in five past orders has ≥ 1 deleted variant; blocking would make the feature feel broken in the common case.

---

## R-003 — Draft sources: clone vs resume

**Decision**: The ↺ icon on a history row whose source has status `draft` navigates straight to that draft on `OrderSummaryScreen` (resume). It does NOT invoke `ordersService.repeat`. The rule lives in the UI hook `useRepeatOrder`, and `ordersService.repeat` itself throws `CannotRepeatDraftError` if called against a draft source, so the boundary is enforced twice.

**Rationale**:

- Cloning a Draft creates two identical drafts for the same client, which makes the Home "Drafts in progress" list (008) confusing — the salesperson cannot tell which one to send. Resume is the intuitive interpretation of "repeat this draft": continue what you started.
- The rule is deliberately placed at the hook layer (not in `ordersService.repeat`) because the service method should stay total and single-purpose (clone). A future caller — e.g. an admin tool that forces a clone-for-audit — can choose to bypass the hook's resume policy without needing a new service method.
- Throwing from `ordersService.repeat` on a Draft source is a second line of defence: if the hook is bypassed by a future caller, the service returns a diagnosable error rather than silently producing a duplicate draft.

**Alternatives considered**:

- **Always clone, let the user reconcile duplicates themselves**. Rejected: puts reconciliation burden on the salesperson for a case that has a clear right answer.
- **Hide the ↺ button on Draft rows entirely**. Rejected: the icon's presence is the affordance that "this row has a repeat action"; removing it per-row breaks the visual pattern and forces the salesperson to guess which rows are clickable. Showing ↺ consistently and having it mean "continue this draft" keeps the pattern uniform.

---

## R-004 — Which past order is "the last" for the hero card?

**Decision**: The hero card targets the client's most recent order with `status = 'sent'`, ordered by `sent_at_ms desc`. If no such order exists (only drafts or only cancelled), the hero card is **not rendered**; the per-row ↺ remains the only repeat entry point.

**Rationale**:

- "Last order" colloquially means the last completed transaction. Showing a hero for a Cancelled last order would either promote a repeat of a cancellation (confusing) or force a status icon on the hero (cluttering the primary CTA).
- Showing the hero for a Draft last order would clash with R-003's resume-on-Draft rule: the hero would be a shortcut to resume, not to repeat, which contradicts its label.
- `sent_at_ms` is already populated by 009's `ordersRepository.markSent` and is the authoritative completion timestamp. Ordering by `created_at_ms` instead would promote an Order that was drafted months ago and sent recently over one that was drafted and sent yesterday — the wrong semantic for "last".

**Alternatives considered**:

- **Use the most-recent order regardless of status and decorate the hero with a status chip**. Rejected: adds UI complexity for a case the per-row ↺ already covers, and muddies the "primary CTA" role of the hero card.
- **Use the most-recent `created_at_ms`**. Rejected — see above, wrong semantic.

---

## R-005 — Atomicity and rollback of the clone write path

**Decision**: The entire clone (new order row + N line rows + order discount update) runs inside a single `database.write(...)` action. Any throw — including a mid-clone variant lookup failure — rolls back every write and leaves the local DB identical to its pre-call state.

**Rationale**:

- P5 ("salesperson data is sacred") treats half-materialised drafts as worse than no draft: a draft with a random subset of the source's lines is indistinguishable to the salesperson from a complete one, and would get sent with missing items.
- WatermelonDB's `database.write(...)` already guarantees atomicity for the actions performed inside it. Wrapping the whole clone in one action — rather than calling the service's public methods which each open their own action — costs nothing and inherits the guarantee automatically.
- The availability gate runs to completion **before** any write: if the gate determines ≥ 1 line is available, the write action proceeds; otherwise it throws before opening the action. This means the all-unavailable path touches zero DB state — verifiable in the unit test by row-counting before and after.

**Alternatives considered**:

- **One action per service method, composed by the caller**. Rejected: each `createDraft` / `addItem` / `setLineDiscount` opens its own transaction, and a mid-chain failure leaves a partially-cloned draft row that needs cleanup. The single-transaction model avoids any cleanup code path.
- **Write to a temporary staging table, then commit**. Rejected: adds a schema object for zero benefit over the single-transaction model; the lines *are* the staging.

---

## Open items

None. All Technical Context entries resolve; no NEEDS CLARIFICATION remains.
