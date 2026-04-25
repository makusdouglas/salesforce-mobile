# SPECS — Backlog de `/speckit-specify`

Lista priorizada de prompts para gerar as specs deste MVP, derivada da [constitution v1.0.0](.specify/memory/constitution.md). Cada bloco é uma `/speckit-specify` independente.

**Como usar**: rode os blocos **em ordem** (cada um assume o anterior pronto). Para features com UI, aceite o prompt do hook `speckit.pencil.design` — as telas no [layout.pen](./layout.pen) viram a fonte primordial da spec.

**Convenção**: prompts em inglês (spec-kit artifacts são em inglês — [memory](.claude/projects/-Users-markusdouglas-DEV-Personal-salesforce-mobile/memory/feedback_spec_language.md)). UI copy dentro do design fica em português.

---

## Fase 1 — Fundação (bloqueia todo o resto)

### 1. Project Foundation & Navigation Shell `[infra]` `[no-ui]` ✅ **Shipped**

Infra mínima: Expo managed workflow, TypeScript strict, React Navigation, estrutura `src/features/`, scripts de dev/build. Sem features de produto ainda.

```
/speckit-specify Bootstrap the Expo + TypeScript project shell: managed workflow, strict tsconfig, React Navigation with a placeholder home and auth stacks, folder structure by feature (src/features/), ESLint + Prettier, dev/preview/production build scripts. No business features yet — just the scaffold every later feature lands on. Identifiers in English; UI copy in Portuguese per constitution §9.
```

> **Pencil hook**: **skip** (backend/infra). Responda "não" ao prompt do hook.

---

### 2. WatermelonDB Schema & Data Layer `[infra]` `[no-ui]` ✅ **Shipped**

Schema inicial das 7 entidades da R2, migrations, adapters. Nenhuma tela — só o data layer que todas as features usam.

```
/speckit-specify Set up WatermelonDB as the sole client-side data layer per constitution R1 and R2. Define the initial schema and Model classes for all seven MVP entities — salespeople, clients, products, product_variants, orders, order_items, payment_receipts — with their relationships, required columns in English, sync-friendly columns (server_id, updated_at, _status, _changed), and a migrations directory. Include a lightweight repository/adapter pattern that every feature will consume; components MUST NOT read Supabase directly.
```

> **Pencil hook**: **skip**.

---

### 3. Supabase Online Authentication (D5) `[auth]` `[ui]` ✅ **Shipped**

Login online, troca de tokens, persistência do refresh token no secure-store, refresh silencioso em background, tratamento de revoke.

```
/speckit-specify Implement online-one-time authentication per constitution §7 D5. Flow: email/password login screen that authenticates against Supabase Auth, exchanges for access_token + refresh_token, persists the refresh_token (never the password) in expo-secure-store (Keychain/EncryptedSharedPreferences). Background silent refresh whenever connectivity returns; 90-day TTL enforcement; on refresh failure, keep local data intact, queue the failed sync, and prompt re-login only on the next network-requiring action. No feature may call validate-token on every tap. Include a logout flow that revokes the refresh token server-side and wipes the secure-store entry.
```

> **Pencil hook**: **accept** — desenhe a tela de login, splash e estados de erro de rede.

---

### 4. Local Lock: Biometric + PIN (D6) `[auth]` `[ui]` ✅ **Shipped**

PIN setup no primeiro run, unlock na abertura fria e após 5min de inatividade, biometria preferida com fallback automático pra PIN.

```
/speckit-specify Implement the mandatory local lock per constitution §7 D6. First-run flow forces the salesperson to set a 4–6 digit PIN (stored hashed in expo-secure-store, never plain). Cold-start and post-inactivity (default 5min, configurable) MUST require unlock via biometrics (expo-local-authentication) when available and enrolled, with automatic fallback to the PIN screen on failure or wet-hand/dirty-sensor scenarios. PIN reset path requires full online re-login against Supabase. Local lock is complementary to D5 — it does not replace Supabase auth, only guards casual access to a lost device.
```

> **Pencil hook**: **accept** — tela de PIN setup, unlock screen (biometria + teclado PIN), reset flow.

---

### 5. Sync Engine (D1 + R1) `[infra]` `[light-ui]` ✅ **Shipped**

Pull-then-push, last-write-wins por timestamp, executado no login/pull-to-refresh/após criar pedido quando online. Indicador de status na home (UX4).

```
/speckit-specify Build the sync engine per constitution D1, R1, and UX4. Pull-then-push order: first pull server changes (catalog, clients, orders from other salespeople) from Supabase into WatermelonDB, then push local changes. Conflict resolution is last-write-wins by updated_at timestamp. Trigger points: on successful login, on manual pull-to-refresh from the home screen, and opportunistically after an order transitions to "sent" when connectivity is available. Expose a discreet always-on sync-status indicator for the home screen (never a modal) with states: in-sync, syncing, offline, failed. No blocking spinner on any business screen.
```

> **Pencil hook**: **accept** — pelo indicador de sync na home (UX4) + estados.

---

## Fase 2 — Dados do Core MVP

### 6. Product Catalog (first cycle do governance review) `[core]` `[ui]` ✅ **Shipped**

Listagem de produtos com variantes, busca rápida tap-first, imagens do Supabase Storage com cache local (R3), catálogo read-only no app (D2).

```
/speckit-specify Deliver the product catalog per constitution D2, R3, UX1, and UX3. Screens: a grid/list of products with their variants, a detail view, and a fast search bar prioritizing tap filters over typing. Catalog is strictly read-only inside the app; products are created/edited by the admin via Supabase dashboard. Product images live in Supabase Storage and MUST be cached locally through expo-file-system so the salesperson sees them offline after the first sync. First-launch empty state (no catalog pulled yet) points to the sync action in plain salesperson language, not system jargon. The constitution calls out this module as the first full spec→plan→tasks→implement cycle — scope it tightly.
```

> **Pencil hook**: **accept** — catálogo grid, detalhe do produto, busca, empty state.

---

### 7. Client Registration & Search `[core]` `[ui]` ✅ **Shipped**

Cadastro local de clientes (D3), listagem, busca, perfil com histórico. CNPJ duplicado → merge manual no admin (fora de escopo do app).

```
/speckit-specify Implement client management per constitution D3 and UX1. Salesperson can register a new client locally (store name, CNPJ, address, contact, notes), search the client list quickly (tap-first filters), and open a client profile that shows the order history and a primary CTA "New order". Duplicate-CNPJ detection is NOT required in the app — conflicts are merged manually by the admin in the Supabase dashboard. Support offline creation: a brand-new client persists locally and syncs when connectivity returns.
```

> **Pencil hook**: **accept** — form de cadastro, lista com busca, perfil do cliente.

---

### 8. Home Dashboard & Empty States `[core]` `[ui]` ✅ **Shipped**

Home do vendedor: sync status (UX4), acesso rápido a catálogo/clientes/pedidos em rascunho, empty states úteis (UX3).

```
/speckit-specify Design the salesperson's home screen as the hub per constitution UX3 and UX4. Surface the always-on sync-status indicator, quick-action cards to Catalog, Clients, and "Drafts in progress", plus the most recent activity (last sent order, last sync time). Every empty state (no catalog yet, no clients, no drafts) MUST speak in the salesperson's language and point to the next concrete step, not system errors. No modal or alert for sync — only the inline indicator.
```

> **Pencil hook**: **accept** — home desktop/mobile, cards, estados de sync.

---

## Fase 3 — Fluxo de Venda

### 9. Order Assembly + Line and Order Discounts (R5 + UX1) `[core]` `[ui]` ✅ **Shipped**

Montagem com tap/incremento, desconto por item e desconto total do pedido, status `draft` persistido localmente, nunca altera `product`.

```
/speckit-specify Implement order assembly per constitution R5, UX1, and D4. From a client profile, the salesperson starts a draft order, browses the catalog, taps products/variants to add with quantity inc/dec controls (no numeric keyboard for the primary path), applies an optional per-line discount (% or absolute), and an optional overall-order discount at the summary step. Discounts MUST be stored on order_item and order — NEVER mutate product prices. Draft orders persist locally across app restarts and appear in the home "Drafts in progress" list. Status transitions use only: draft, sent, canceled.
```

> **Pencil hook**: **accept** — catálogo-em-pedido, resumo, campo de desconto, drafts.

---

### 10. Repeat Last Order (UX2) `[core]` `[ui]` ✅ **Shipped**

Repetir o último pedido do cliente em 1–2 taps, com opção de editar antes de confirmar.

```
/speckit-specify Implement "repeat last order" as a first-class flow per constitution UX2. From a client's order history, a single tap creates a new draft cloning the last order's line items, quantities, and discounts; the salesperson lands directly on the order summary and can either send immediately or tap to edit items before sending. Maximum 2 taps from client profile to "ready to send". This flow MUST NOT be hidden inside a menu — it is a primary CTA on the client profile when history exists.
```

> **Pencil hook**: **accept** — histórico do cliente, CTA repeat, resumo pronto.

---

### 11. Order PDF Generation & Email Intent (R4) `[core]` `[ui]` ✅ **Shipped**

Gerar PDF do pedido localmente (expo-print), abrir share sheet / email intent com anexo, destinatário e assunto pré-preenchidos. Transitiona status para `sent`.

```
/speckit-specify Implement order-to-email delivery per constitution R4. On the order summary, a "Send" action generates a PDF locally with expo-print (no server render, no delivery service like SendGrid/Resend), then opens the device's share sheet / mail intent with the client's email in To, a pre-filled subject, a templated body, and the PDF attached. The salesperson confirms and sends from their own mail account; on return to the app, the order transitions to status "sent" with the PDF path and timestamp recorded locally. PDF template MUST include: salesperson, client, items, per-line and order discounts, totals, and a human-readable order number. No fiscal-invoice formatting — this is a quote/intent document.
```

> **Pencil hook**: **accept** — preview do PDF, dialog de send.

---

### 12. Payment Receipts `[core]` `[ui]` ✅ **Shipped**

Registrar recebimento (valor, método, data, foto opcional do comprovante), upload da imagem pra Supabase Storage com cache local.

Append-only model — correções são novos recibos referenciando o original via `correction_of_receipt_id`. Entry point: tap num pedido `sent` no `ClientProfileScreen` → `OrderReceiptsScreen`. Fluxo completo offline (criação + visualização + correção); upload do anexo pra `receipt-attachments` bucket acontece no próximo sync via `receiptAttachmentUploader.flushPending()`.

- Spec: [specs/012-payment-receipts/spec.md](specs/012-payment-receipts/spec.md)
- Plan: [specs/012-payment-receipts/plan.md](specs/012-payment-receipts/plan.md)
- Design: [specs/012-payment-receipts/design/screens.md](specs/012-payment-receipts/design/screens.md) (7 frames incl. Phase 8 client-history variant)
- Tasks: [specs/012-payment-receipts/tasks.md](specs/012-payment-receipts/tasks.md) (67 tasks incl. Phase 8 follow-up on ClientProfile rows; 65 done + 2 deferred)

**Phase 8 follow-up**: `ClientProfileScreen` order-history rows now show a Paid / Partial / Pending / Ajuste-pendente chip + "R$ received de R$ total", derived live from `paymentReceiptsRepository.observeByOrder()`. Drafts keep the single-line shape; only sent orders get the bottom row.

```
/speckit-specify Implement payment-receipt recording against the payment_receipts entity. From an order detail, the salesperson registers a receipt with amount, method (cash, pix, transfer, check, other), date, optional notes, and an optional photo or pdf  captured via camera or picked from the library. Files upload to Supabase Storage on next sync and are cached locally via expo-file-system (same pattern as R3). Offline creation is mandatory — everything persists locally and syncs opportunistically. A receipt is append-only; corrections are new receipts with a reference back to the original.   
```

> **Pencil hook**: **accept** — form de receipt, captura de foto, histórico.

---

### 13. Orders Overview & Accounting Summary `[core]` `[ui]` ✅ **Shipped**

Artifacts: [spec.md](specs/013-orders-overview/spec.md) · [plan.md](specs/013-orders-overview/plan.md) · [tasks.md](specs/013-orders-overview/tasks.md) · [design/screens.md](specs/013-orders-overview/design/screens.md)

Tela única para o vendedor consolidar **todos** os seus pedidos (rascunho / enviado / cancelado) com filtros por status, mês e busca, mais uma faixa de resumo para prestação de contas (faturado, recebido, pendente). Status de pagamento é **derivado** das `payment_receipts` (feature 12) — nenhum novo valor de status é introduzido (respeita D4). Inclui uma tela secundária `OrderDetail` somente-leitura para pedidos `sent` / `canceled`, que também destrava o TODO em `HomeScreen.tsx:111` (tap no card "Atividade recente") e o gancho da feature 10 (Repeat Last Order) para abrir detalhe antes de clonar.

```
/speckit-specify Implement an orders overview screen for the salesperson that consolidates all their orders for reconciliation per constitution UX1, UX3, and D4. Screen lists every order owned by the logged seller (any status) with tap-first filters: status chips (Rascunhos / Pendente pagamento / Pago / Cancelados), month selector (current month default, scrub prev/next), and free-text search by client name or order number. Each row shows client, total, status chip, relevant timestamp (updated for drafts, sent_at for sent, canceled_at for canceled), and a paid/pending indicator derived from payment_receipts: sum of receipts.amount ≥ order.total → "Pago"; 0 < sum < total → "Parcial"; sum = 0 on a sent order → "Pendente"; canceled is its own terminal label; draft is its own terminal label. A summary band at the top of the list MUST show, aggregated over the active filter window: orders count, total billed (sum of totals of sent orders only), total received (sum of payment_receipts.amount within the month, across sent orders), and total pending (billed − received, floored at 0). Tapping a row opens OrderDraft for drafts and a new read-only OrderDetail screen for sent/canceled — same visual layout as OrderSummary but every mutation control is absent or disabled; the screen is reachable from three entry points: (a) this orders list, (b) Home "Atividade recente" card (replaces the stub at HomeScreen.tsx:111), (c) client profile order history (feature 7). No new status enum value — "Pago / Pendente / Parcial" are UI-only derivations, never written to orders.status. Offline-first; reads only from WatermelonDB via repositories — no Supabase calls on this surface. Add the list as a fourth entry point on Home (new QuickActionCard "Pedidos") in addition to "Rascunhos em andamento".
```

> **Pencil hook**: **accept** — OrdersListScreen (com chips de filtro + mês + busca + faixa de resumo), OrderDetail read-only, empty states por filtro, phone + tablet.

---

## Fase 4 — Módulo Admin

> Introduzida na constitution v1.0.0. O papel ADMIN traz para dentro do app cadastros que antes viviam no Supabase dashboard. ADMIN é online-first (P6) e convive com VENDEDOR via dual-role visibility (UX6).

### 14. Admin Role Foundation + Products CRUD `[admin]` `[ui]` ✅ **Shipped**

Primeira feature admin — carrega a fundação RBAC (tabela `user_roles`, propagação de roles na sessão, aba Admin role-guarded no root navigator, hook `useUserRoles`) mais o CRUD completo de produtos/variantes com upload de foto. As features seguintes (14, 15) consomem essa fundação.

```
/speckit-specify Implement the ADMIN role foundation and the products/variants CRUD per constitution v1.0.0 D7, UX6, P6. Foundation: create a user_roles(user_id, role) table in Supabase, seed the first admin via manual migration, expose roles in the session state post-login, add a role-guarded "Admin" tab in the root navigator that appears only when the signed-in user carries role 'admin'. Dual-role users (admin + seller) see both the seller home and the Admin tab simultaneously (UX6) — no mode toggle. CRUD: admin screens for listing and creating/editing products (name, description, category, base price, image) and their variants (attributes, price). Images are chosen via expo-image-picker, resized via expo-image-manipulator, uploaded directly to Supabase Storage, and the resulting URL is stored on the product row. Writes go straight to Supabase via the client — ADMIN operations are online-required (P6) and do NOT use WatermelonDB's push queue. RLS policies MUST enforce that only role 'admin' can INSERT/UPDATE/DELETE on products and product_variants. After any admin write, trigger a sync pull so the seller-side local cache (feature 5) propagates the change.
```

> **Pencil hook**: **accept** — AdminHome, AdminProductList, AdminProductForm, AdminVariantList, AdminVariantForm, image picker flow. Phone + tablet para cada (UX5).

---

### 15. Admin Sellers Management `[admin]` `[ui]` ✅ **Shipped**

CRUD de vendedores pelo admin. Criar vendedor = criar usuário Supabase Auth via Edge Function (o client nunca carrega service_role), registrar em `salespeople` e atribuir role `seller` em `user_roles`. Desativar preserva histórico e revoga apenas a role.

```
/speckit-specify Implement admin-side seller management on top of the foundation shipped in feature 14. Admin screens for listing existing sellers, creating a new seller (name, email, initial password or passwordless invite), editing (name, active/inactive flag), and deactivating a seller. Creating a seller requires creating a Supabase Auth user — which needs the service_role key and therefore MUST go through an Edge Function (admin-create-seller) invoked by the client; the client never holds service_role. The Edge Function also inserts the matching row in salespeople and assigns role 'seller' in user_roles atomically. Deactivation flips an active flag and revokes the 'seller' role but preserves the salespeople row for historical order references. RLS ensures only role 'admin' can invoke the Edge Function and write to salespeople or user_roles.
```

> **Pencil hook**: **accept** — AdminSellerList, AdminSellerForm, confirmação de deactivate.

---

### 16. Product Lifecycle + Granular Admin Roles `[admin+core]` `[ui]`

Dois refinamentos encadeados do módulo admin:

- **Parte A — Desativação de produtos**: admin pode marcar produto como inativo. Inativos somem do catálogo do vendedor, não podem ser adicionados a pedidos novos, bloqueiam envio de rascunhos que os contenham, e o "repeat last order" alerta antes de clonar (removendo silenciosamente nunca). `AdminProductList` ganha filtro "Mostrar inativos" e busca por texto.
- **Parte B — Roles granulares**: `user_roles` passa de `{admin, seller}` para um conjunto de roles nomeadas (`manage-products`, `manage-salespersons`, `manage-clients`, `superuser`). Cada sub-tela admin é gatedada pela role correspondente; só `superuser` gerencia roles de outros usuários. Role legada `admin` migra para `superuser`.

```
/speckit-specify Ship two tightly related admin refinements on top of features 6, 9, 10, 14, 15.

PART A — Product deactivation lifecycle (touches catalog + order flow + admin products):
Add products.active (boolean, default true) and products.deactivated_at (timestamp, nullable). AdminProductForm gets a toggle to deactivate/reactivate with a confirmation dialog that surfaces how many drafts currently include the product. AdminProductList shows only active products by default with a tap-first filter chip "Mostrar inativos" to toggle inclusion; deactivated rows render dimmed with an "Inativo" chip. Add a free-text search bar to AdminProductList filtering on name and category. On the seller side: deactivated products MUST disappear from the catalog grid/list, MUST NOT be addable to new draft orders, and the order-assembly add control MUST block them even via deep link or cached reference. Existing drafts that include a now-deactivated product raise an alert on open listing each discontinued line, and the draft cannot be sent until those lines are removed. "Repeat last order" (feature 10) MUST — when the source order contains any discontinued product — show a dialog listing the affected lines ("X foi descontinuado — será removido da cópia") and clone only the still-active lines; never silently drop. Historical sent/canceled orders (feature 13) and payment receipts (feature 12) keep showing discontinued lines verbatim since that data is immutable history.

PART B — Granular admin roles (replaces the single 'admin' flag from feature 14):
Extend user_roles to support multiple named admin-grade roles per user: 'manage-products', 'manage-salespersons', 'manage-clients', and 'superuser' (implies every other admin-grade role, including future ones). Migrate any existing rows with role = 'admin' to 'superuser'. The Admin tab in the root navigator is visible when the user carries at least one admin-grade role; each admin sub-screen is independently gated by its required role (AdminProductList → 'manage-products' or 'superuser'; AdminSellerList → 'manage-salespersons' or 'superuser'; AdminClientList → 'manage-clients' or 'superuser'). Add a "Users & Roles" section under Admin, visible only to 'superuser', that lists every user (admins + sellers), opens a detail view, and toggles individual roles on/off. Creating/editing a seller (feature 15) still assigns 'seller' automatically; granting admin-grade roles is an explicit separate action. RLS: only 'superuser' can INSERT/UPDATE/DELETE rows in user_roles. Every existing RLS policy that currently checks role = 'admin' MUST be updated to also accept 'superuser' plus the module-specific role relevant to that table (products/variants → 'manage-products' or 'superuser'; salespeople → 'manage-salespersons' or 'superuser'; clients → 'manage-clients' or 'superuser'). Surface the signed-in user's active roles on the profile screen for transparency.
```

> **Pencil hook**: **accept** — toggle ativo/inativo + dialog de confirmação no AdminProductForm, filtro "Mostrar inativos" + busca no AdminProductList, alerta de produto descontinuado no catálogo/rascunho/repeat, AdminUsersList + AdminUserRolesForm com toggles por role, badge de roles no perfil.

---

### 17. Revenue Dashboard (Admin + Seller View) `[admin+core]` `[ui]`

Dashboard mês-a-mês para acompanhar receita. Admin vê agregado de todos os vendedores com filtro opcional por vendedor; vendedor vê o atalho na própria home (UX3) abrindo a mesma tela escopada a si. Três séries no chart principal — **Faturado** (sum de `orders.total` para `sent`), **Recebido** (sum de `payment_receipts.amount`), **Pendente** (Faturado − Recebido, floor em 0) — derivadas, sem novo valor de status (D4). Admin lê via RPC online (P6); vendedor agrega localmente do WatermelonDB (R1, offline-first). Inclui KPI band com delta MoM, ranking de vendedores (admin), top 3 clientes & produtos, aging de recebíveis, e overlay YoY. Drill-down no mês reusa `OrdersListScreen` (F13).

```
/speckit-specify Implement a revenue dashboard accessible to admins (aggregated across all sellers, with an optional single-seller filter) and to each seller (own data only, reached via a home-screen shortcut), per constitution P6, R1, UX1, UX3, UX5, UX6, D4. The same screen powers both views; visibility scope is determined by the signed-in user's role.

Layout (top → bottom):
1. KPI band — Recebido (current month), Faturado, Pendente, Ticket médio, Nº de pedidos enviados. Each KPI shows the absolute value plus delta % vs the previous month (up/down indicator). Admin KPIs aggregate across sellers honoring the active filter; seller KPIs are scoped to self.
2. Monthly trend chart — last 12 months window with three series: Faturado, Recebido, Pendente. Tapping a month opens OrdersListScreen (feature 13) pre-filtered to that month and to the active seller filter (or all sellers, for admin without filter). Include an overlay toggle "Comparar com ano anterior" that adds a fainter set of points for the same months one year ago, when historical data exists.
3. Seller ranking (admin only) — horizontal bar chart of Recebido by seller for the active month, sorted desc. Tapping a bar sets the seller filter on this dashboard. Hidden for seller view.
4. Top clients & top products — two compact lists (side-by-side on tablet, stacked on phone): Top 3 clients by Recebido and Top 3 products by units sold within the active filter window. Tapping a client opens the client profile (feature 7); tapping a product opens AdminProductForm (feature 14) for admin or the catalog detail (feature 6) for seller.
5. Aging de recebíveis — bucketed bars showing total Pendente across sent orders by age of `orders.sent_at`: 0–30 dias, 31–60, 61–90, >90. Per-order pendente = max(0, order.total − sum of receipts.amount), summed by bucket. Scoped by filter.

Filters (admin only):
- Vendedor — chip "Todos" + tap-first list of active sellers; selecting one re-scopes every panel including the drill-down target.
- Período — month range picker; default is current month for KPIs/aging and last 12 months for the trend chart.

Data sources:
- ADMIN side is online-first per P6: panels read from Supabase via dedicated RPCs/views (e.g. `admin_revenue_monthly`, `admin_revenue_by_seller`, `admin_top_clients`, `admin_top_products`, `admin_receivables_aging`) returning pre-aggregated rows. Do NOT pull raw orders/receipts client-side to aggregate. Cache the last successful response in memory only — no WatermelonDB write.
- SELLER side is offline-first per R1: the same panels (minus the seller-ranking and the vendedor filter) are computed locally from WatermelonDB via repositories — no Supabase calls. The home shortcut works fully offline.

Access:
- Admin: any user with an admin-grade role sees a new "Receita" card on AdminHome (feature 14) — no new role gate beyond admin visibility (the granular roles from feature 16 do NOT introduce a "view-revenue" role).
- Seller: a new "Minha receita" card on the seller home (feature 8) opens the seller-scoped variant. Sits alongside Catalog / Clients / Pedidos / Rascunhos; replaces nothing.
- Dual-role users (UX6) see both cards simultaneously and the dashboard auto-detects which scope to load based on entry point.

Constraints:
- No new status enum values; no mutations to orders or receipts on this surface — read-only derivations only (D4).
- Decimal handling and currency formatting follow the existing R$ conventions used in feature 13's summary band.
- Charting library: pick one off-the-shelf React Native option (e.g. victory-native or react-native-gifted-charts) — capture the choice and rationale in research.md during /speckit-plan. Charts MUST render legibly on phone and tablet (UX5) and degrade gracefully when data is sparse (empty-state copy in salesperson language per UX3, never a broken chart).
```

> **Pencil hook**: **accept** — RevenueDashboardScreen (admin com filtros + ranking de vendedores), variante de vendedor (sem ranking nem filtro), KPI band com deltas MoM, chart de tendência com toggle YoY, top clientes/produtos, aging buckets, empty states (sem dados / sem conexão no admin / mês vazio), card "Receita" no AdminHome e "Minha receita" na seller home. Phone + tablet (UX5).

---

### 18. Admin Clients Management `[admin]` `[ui]`

CRUD admin-side de clientes. Complementa D3 (vendedor cria clientes em campo) permitindo admin editar qualquer cliente, inclusive os criados por vendedores. Busca rápida com filtro por vendedor-dono. Merge de duplicatas continua out-of-scope per D3.

```
/speckit-specify Implement admin-side client management on top of the foundation shipped in feature 14 and the granular roles from feature 16. Admin screens for listing all clients across all sellers, creating a client (same fields as the seller-side flow in feature 7: store name, CNPJ, address, contact, notes), editing any client regardless of who created it, and marking a client as inactive. RLS: roles 'manage-clients' and 'superuser' can SELECT/INSERT/UPDATE/DELETE any row in clients; role 'seller' retains the existing rules (create any, edit only their own). Admin edits sync down to the owning seller's device on the next pull (feature 5). Duplicate-CNPJ merging remains out of scope per constitution D3 — the admin can manually resolve duplicates by editing/deleting rows. The admin client list MUST support fast search (tap-first filters for seller-owner and status, text search for name/CNPJ).
```

> **Pencil hook**: **accept** — AdminClientList com filtro por vendedor, AdminClientForm.

---

## Fase 5 — Resiliência

### 19. Emergency Export / Local Backup (P5) `[infra]` `[light-ui]`

Export manual do WatermelonDB em formato legível (JSON/ZIP) compartilhável via share sheet, para mitigar reinstall/crash/troca de device.

```
/speckit-specify Implement the emergency export per constitution P5 — the safety net against device loss, reinstall, or crash between syncs. From a settings/profile screen, the salesperson taps "Export my data" and the app produces a timestamped archive (ZIP containing JSON dumps per entity + copies of cached receipt/product images) and opens the share sheet so they can email it to themselves, save to iCloud/Drive, or AirDrop. Export is available offline, runs fully on-device, and MUST NOT touch Supabase. Document that import-from-backup is out of scope for the MVP — export alone is enough to avoid data loss during a rescue call with the admin.
```

> **Pencil hook**: **light** — uma tela de settings simples, pode pular ou aceitar.

---

## Referências rápidas

- **Constitution**: [.specify/memory/constitution.md](.specify/memory/constitution.md) — v0.2.0
- **Design source**: [layout.pen](./layout.pen) (Pencil MCP)
- **Hook do Pencil**: [.specify/extensions/pencil/](.specify/extensions/pencil/) — opcional, pule em blocos `[no-ui]` / `[infra]`
- **Fora de escopo do MVP** (não gere specs disso): ver constitution §8 (multi-catálogo, price tables por cliente, inventory, routes, reports, push, chat, Bluetooth printer, digital signature, multi-tenant)

## Ordem curta (copia-cola)

```
1.  ✅ Project Foundation & Navigation Shell       [infra]
2.  ✅ WatermelonDB Schema & Data Layer            [infra]
3.  ✅ Supabase Online Authentication (D5)         [auth/ui]
4.  ✅ Local Lock: Biometric + PIN (D6)            [auth/ui]
5.  ✅ Sync Engine (D1 + R1)                       [infra/light-ui]
6.  ✅ Product Catalog — first governance cycle    [core/ui]
7.  ✅ Client Registration & Search                [core/ui]
8.  ✅ Home Dashboard & Empty States               [core/ui]
9.  ✅ Order Assembly + Discounts                  [core/ui]
10. ✅ Repeat Last Order                           [core/ui]
11. ✅ Order PDF + Email Intent                    [core/ui]
12. ✅ Payment Receipts                            [core/ui]
13. ✅ Orders Overview & Accounting Summary        [core/ui]
14. ✅ Admin Role Foundation + Products CRUD       [admin/ui]
15. ✅ Admin Sellers Management                    [admin/ui]
16. Product Lifecycle + Granular Admin Roles    [admin+core/ui]
17. Revenue Dashboard (Admin + Seller View)     [admin+core/ui]
18. Admin Clients Management                    [admin/ui]
19. Emergency Export                            [infra/light-ui]
```
