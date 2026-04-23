# UI Design — Client Management (007)

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-22
**Roles**: `seller` (VENDEDOR) only — per constitution D3 and UX6 (admin-only clients CRUD is deferred to feature 015).

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| Clients list — phone | `ol4CQ` | [client-list-phone.png](./client-list-phone.png) | Tap-first filter chips (Recentes + initial letters), text search, prominent "Novo cliente" CTA, list rows with pending-sync indicator on unsynced entries (US1/US3, FR-001/005/020/024). |
| Clients list — empty (first-launch) — phone | `gnjgv` | [client-list-empty-phone.png](./client-list-empty-phone.png) | Seller-language guidance pointing at "Novo cliente"; explicitly mentions offline-friendly creation (FR-026/FR-027). |
| Clients list — no matches (search) — phone | `JtIt0` | [client-list-no-matches-phone.png](./client-list-no-matches-phone.png) | Distinct from first-launch empty state: keeps the search chrome visible, offers both "Limpar busca" and "Cadastrar novo" as next steps (FR-025). |
| New client form — phone | `YwVIa` | [new-client-phone.png](./new-client-phone.png) | Only store name is required (yellow `Obrigatório` pill); CNPJ/endereço/contato/observações optional; inline draft-persistence hint; bottom Cancelar + Salvar row; no blocking spinner (FR-002/010/011). |
| Client profile — phone | `C0KRb` | [client-profile-phone.png](./client-profile-phone.png) | Store identity + order history with status badges (Enviado / Cancelado); canceled orders visually muted; sticky "Novo pedido" CTA above the fold (FR-012/014/015/017/018). |
| Client profile — empty history — phone | `kQnDq` | [client-profile-empty-phone.png](./client-profile-empty-phone.png) | Empty-history variant on a newly registered, still-unsynced client (pending amber pill). Empty-state copy points to "Novo pedido" as the next step (FR-016/019). |
| Clients list — tablet | `c2qmp` | [client-list-tablet.png](./client-list-tablet.png) | Top-bar "Novo cliente" action, more filter chips inline (A–V), rows carry a right-aligned "Último pedido" meta column — uses the wider viewport meaningfully, not a stretched phone (FR-028/FR-029). |
| Clients list — empty (first-launch) — tablet | `bJaze` | [client-list-empty-tablet.png](./client-list-empty-tablet.png) | Centered empty-state card (~520 px) instead of a stretched phone layout. |
| Clients list — no matches (search) — tablet | `yCDAy` | [client-list-no-matches-tablet.png](./client-list-no-matches-tablet.png) | Centered empty-result card with side-by-side reset + cadastrar-novo actions. |
| New client form — tablet | `1NI9V` | [new-client-tablet.png](./new-client-tablet.png) | Centered form card (~620 px), CNPJ + Contato laid out side-by-side (2-col grid row); Cancelar/Salvar moved into the top bar to keep the save action one tap away. |
| Client profile — tablet | `ymEhF` | [client-profile-tablet.png](./client-profile-tablet.png) | Split layout: left column (320 px) = store card, right column = order history list. Each order row is a single-line card with date, status badge and total. Satisfies FR-029's "use the wider viewport meaningfully". |
| Client profile — empty history — tablet | `lG0qd` | [client-profile-empty-tablet.png](./client-profile-empty-tablet.png) | Split layout; empty-history card is centered in the right column on an unsynced client (amber sync dot in top bar + pending pill in store card). |

## Components referenced

The file's existing design-system components were reviewed but not instantiated for these screens — the clients-module rows, cards, chips and form fields were composed from raw frames/texts for tighter control over layout and language. Notable raw building blocks:

- Avatar circle (`40×40` phone / `44×44` tablet, `#F4F4F5` fill, `#E4E4E7` stroke) — carries the store's initial letter.
- Sync badges — two variants: `#DCFCE7 / #166534` ("Sincronizado") and `#FEF3C7 / #92400E` ("Envio pendente"), both as rounded pills with a 6 px dot.
- Status badges on order rows — `Enviado` (green) and `Cancelado` (red, plus muted row background `#FAFAFA` on the row container) — keeps canceled orders visible but clearly deprioritized (FR-015).
- `Obrigatório` requirement pill on form labels — `#FEF3C7 / #92400E` with `#FDE68A` stroke. Used only on `Nome da loja`; every other field is labeled `· Opcional` inline (FR-002 assumption).
- Primary CTA — `#18181B` fill, `#FAFAFA` text, `48–52` px tall, corner radius 10. Present as sticky bottom action on phone profile, inline row on phone list, and top-bar-right button on tablet list/profile/form.

## Design decisions

- **Font and color stack match the existing `layout.pen`, not `pencil-config.yml`.** The config calls for Funnel Sans / Inter / Geist + "Lavender Cream" palette, but every prior feature (001–006) in this file uses `Inter` with a neutral hex palette (`#0A0A0A / #71717A / #E4E4E7 / #FAFAFA / #FFFFFF / #16A34A / #F59E0B`). Introducing the config stack in this feature alone would break visual harmony across 16 existing frames. Flagged in **Open questions** below.
- **Primary CTA lives at the bottom on phone, in the top bar on tablet.** On phone, the `Novo cliente` / `Novo pedido` / `Salvar` button is a large row at the bottom of the viewport — reachable one-handed while standing in a store. On tablet, the same action moves to the top-bar-right, which reads as the dominant action under desktop-ish visual conventions without sacrificing reachability on a two-handed device.
- **Pending-sync is an ambient signal, never a modal.** On list rows, it's a 7 px amber dot next to the store name plus an italic `Envio pendente` label on the secondary line. On the profile, it's a small amber pill next to the CNPJ line and an amber sync-dot in the top bar. No blocking UI, no confirmation dialog, no banner — matches constitution P1 (no blocking full-screen spinner) and UX4 (discreet per-row indicator).
- **Tablet top-bar sync indicator is dot + label.** Matches the convention already established by Catalog/Tablet, ProductDetail/Tablet and CatalogEmpty/Tablet in features 001–006: a 10 px dot (`#16A34A` synced / `#F59E0B` pending) followed by `Sincronizado` or `Aguardando sincronização` in `#52525B` 13 px. Phone top bars keep the dot-only variant because horizontal room is tight on 390 px portrait; on tablet there's space for the full label so users don't have to learn a color code.
- **Three distinct "empty" experiences.** (a) First-launch (no clients ever): centered storefront/users icon + hero copy + `Novo cliente` CTA; (b) Search no-matches: search chrome remains visible, result card offers `Limpar busca` AND `Cadastrar novo` side-by-side; (c) Profile with no orders: empty card inside the history area, existing profile header unchanged so the seller sees they're on the right store. Each is visually distinct so the seller never confuses "I filtered" with "there's nothing here yet".
- **Canceled orders are visible but demoted.** The canceled row uses `#FAFAFA` background (vs `#FFFFFF` for active rows), `#71717A` date text (vs `#0A0A0A`), `#A1A1AA` total text, and a red `Cancelado` badge. Canceled orders are neither hidden nor deleted from history — matches constitution D4.
- **Tap-first filters degrade gracefully.** The chip row shows `Recentes` + a trimmed alphabet (A, M, S, T on phone; A–V on tablet). Per FR-020 and the Assumptions section of the spec, when a dimension has fewer than two useful values the chip row degrades to text search only — represented in the mocks by an omissão of empty chips, not by rendering placeholders.
- **Address and contact are single free-text blocks.** Matches the Assumptions section of the spec (no structured CEP lookup, no structured contact sub-form) to minimize typing in the field.
- **Salvar is shown as a short label ("Salvar"), not "Salvar cliente".** On a tight mobile form the longer wording adds visual weight without helping. The form's title ("Novo cliente") already frames what is being saved.

## Open questions for the spec

- **Project-wide font/palette migration.** `pencil-config.yml` specifies a richer style guide (Funnel Sans headings, Geist captions, Lavender Cream palette, Fluid Ribbon Gradients). This feature did not apply it to preserve cohesion with features 001–006. A cross-feature pass to migrate the whole `layout.pen` would need its own feature/PR.
- **Admin/seller dual-role top bar affordance.** Constitution UX6 says a user with both `admin` AND `seller` roles sees the VENDEDOR surface (incl. this module). These mocks do not show any role-switcher chrome — that belongs to a parent shell, out of scope here. Confirm the shell already covers it; otherwise add a task to feature 008+.
- **Client name length truncation threshold.** Phone list rows use a single-line `fill_container` text that will ellipsize. The exact character budget (how many characters of a store name fit on a 390 px row before ellipsis) is not pinned down in the mock — leave it to the implementing component's default.
- **"Recentes" definition.** The Assumptions section of the spec leaves N (days) open ("last N days, to be tuned in the plan"). Mocks assume the chip is permanent when the seller has any recent activity; if the rule is stricter, the chip may disappear for new sellers.
