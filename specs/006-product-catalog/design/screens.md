# UI Design — Product Catalog

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-21

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| Catalog / Phone | `oE6Po` | [catalog-phone.png](./catalog-phone.png) | Default populated state: 2-column grid, tap-first filter chips, search field fallback. |
| Catalog / Tablet | `R70uK` | [catalog-tablet.png](./catalog-tablet.png) | Same layout, 3-column grid, more filter chips inline, sync-status label visible. |
| ProductDetail / Phone | `WCgvx` | [product-detail-phone.png](./product-detail-phone.png) | Stacked hero + info + variants list. Read-only, no create/edit affordance. |
| ProductDetail / Tablet | `ow0Ma` | [product-detail-tablet.png](./product-detail-tablet.png) | Side-by-side split: hero left, info + variants right. Portrait-only. |
| CatalogEmpty / Phone | `YkrkF` | [catalog-empty-phone.png](./catalog-empty-phone.png) | First-launch empty state. Plain language, amber sync-status dot, primary `Sincronizar agora` CTA. |
| CatalogEmpty / Tablet | `74wU8` | [catalog-empty-tablet.png](./catalog-empty-tablet.png) | Same copy constrained to a ~460 pt max-width centered column so the CTA does not stretch edge-to-edge. |

## Components referenced

None of the existing 87 reusable components in `layout.pen` were referenced — every node in the six frames is an ad-hoc frame/text/icon_font to keep this first spec cycle tightly scoped. Shared patterns that emerged (top bar, sync-status chip, primary dark button, variant row) are candidates for extraction into reusable components during a later pass, once the same shapes appear in at least one other feature (orders, clients).

## Design decisions

- **Matched the existing file's shadcn-neutral aesthetic instead of applying the `Anchored Ribbon Grid` / `Lavender Cream` / `Fluid Ribbon Gradients` style guide from [pencil-config.yml](../../../.specify/extensions/pencil/pencil-config.yml).** The existing auth screens (Login, Relogin, PinSetup, Lock, PinRecoveryConfirm — all already in `layout.pen`) are built on Inter 14/16/22, zinc-neutral greys (`#0A0A0A`, `#52525B`, `#71717A`, `#E4E4E7`), and `#18181B` buttons. Diverging into a lavender/ribbon aesthetic for the catalog would have created a two-app feel. The style guide should be re-applied as a dedicated pass across ALL screens (including the auth ones) rather than carved out for a single module.
- **Product thumbnails use real AI-generated product photography for 5 of 6 cards, with 1 card deliberately left as the neutral default placeholder** (grey `#F5F5F5` background + `inventory_2` icon in `#A1A1AA`). Reason: the happy path on a real device shows actual product photos served from the local cache (SC-002 targets 95%), and FR-012 requires a **single neutral placeholder** for the fallback — not a rainbow of category icons. The `Biscoito Rech.` card models that fallback explicitly so reviewers can see both states side-by-side. At implementation time, real photos come from Supabase Storage per R3; the placeholder mirrors the design shown here.
- **Sync-status dot anchored in the top bar of every catalog screen.** Phone shows the colored dot alone (space-constrained); tablet adds a label ("Sincronizado" / "Aguardando sincronização") since UX5 frees up more horizontal room. The amber dot on the empty-catalog frame signals the sync-required state — same color system as constitution §5 UX4 is expected to use (to be confirmed when the home-screen sync indicator from feature 005 gets its own frames).
- **Tap filter chips, pill-shaped (`cornerRadius: 16` phone / `18` tablet), with the active chip reversed (dark fill, light text).** This codifies UX1's "tap, not type": the chip row is the first horizontal control under the search field, before the keyboard would even open. Typing is explicitly placed above the chips but styled as a lighter affordance.
- **Product detail reserves a large hero image region** (260 pt tall on phone, 360 × 420 pt panel on tablet). Corner-store catalog photos tend to be product-on-white; the larger region gives them room to breathe when shown to the retailer. Variants live in their own list below (phone) or to the right (tablet), in white cards with thin borders — not buttons, since adding to an order is a separate flow owned by feature 007+.
- **Empty-state copy is deliberately plain Portuguese** ("Seu catálogo está vazio", "Ainda não baixamos os produtos neste aparelho", "Você precisa de internet só na primeira vez"). No jargon, no error codes, no mention of "sync daemon" or "fetch failed". The CTA uses the same verb the salesperson will later recognize from the home-screen sync indicator (feature 005).
- **Tablet layouts use the wider viewport meaningfully, not a stretched phone layout** — per UX5:
  - Catalog: 2 → 3 columns, chips row includes a 5th chip (`Limpeza`), sync status gets a label.
  - ProductDetail: vertical stack → horizontal split (hero left, info right).
  - Empty: content constrained to a 460 pt centered column so the primary button does not stretch the full 820 pt width.
- **Landscape is out of scope** per constitution §5 UX5; all frames are portrait.

## Open questions for the spec

- **Home → Catalog navigation affordance**: the back chevron in the top bar assumes the catalog is pushed from the home screen. Whether the home screen uses a tab bar, a card grid, or a simple menu will be decided when the home screen itself is specified — the catalog's top bar should be able to accommodate both patterns without a frame redesign.
- **Variant-attribute display shape on detail**: for Refri Cola the variant names (`Garrafa 2L`, `Lata 350ml`, `Pet 600ml`) already encode the differentiating attribute, so the subtitle line in each row is descriptive rather than structured. For products where size + color + flavor compose the identity (e.g. a branded soap line), a structured attribute row (chips inside the variant row) may be needed. Deferred until a real admin-loaded catalog lands.
- **Sync-status color tokens**: `#16A34A` (green) and `#F59E0B` (amber) were used inline. These are not yet formalized in the file's variables. They should be promoted to `--sync-ok` / `--sync-warning` once feature 005's home-screen indicator is designed and the four states (`in-sync`, `syncing`, `offline`, `failed`) each get a canonical color.
- **Placeholder tokenization**: the neutral placeholder on card 6 uses inline values (`#F5F5F5` background, `#A1A1AA` icon on `inventory_2` from Material Symbols Rounded). These should be promoted to `--placeholder-surface` / `--placeholder-fg` variables once a second placeholder surfaces elsewhere (e.g. an avatar fallback on a client row) — not before, to avoid premature abstraction.
- **"No matches" search state**: required by the spec (FR-018) but not drawn in this session. It is a variant of the catalog list with the grid replaced by a compact inline state, and should be added to a follow-up Pencil pass once the real chip-filter behavior is defined.
