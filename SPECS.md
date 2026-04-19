# SPECS — Backlog de `/speckit-specify`

Lista priorizada de prompts para gerar as specs deste MVP, derivada da [constitution v0.2.0](.specify/memory/constitution.md). Cada bloco é uma `/speckit-specify` independente.

**Como usar**: rode os blocos **em ordem** (cada um assume o anterior pronto). Para features com UI, aceite o prompt do hook `speckit.pencil.design` — as telas no [layout.pen](./layout.pen) viram a fonte primordial da spec.

**Convenção**: prompts em inglês (spec-kit artifacts são em inglês — [memory](.claude/projects/-Users-markusdouglas-DEV-Personal-salesforce-mobile/memory/feedback_spec_language.md)). UI copy dentro do design fica em português.

---

## Fase 1 — Fundação (bloqueia todo o resto)

### 1. Project Foundation & Navigation Shell `[infra]` `[no-ui]`

Infra mínima: Expo managed workflow, TypeScript strict, React Navigation, estrutura `src/features/`, scripts de dev/build. Sem features de produto ainda.

```
/speckit-specify Bootstrap the Expo + TypeScript project shell: managed workflow, strict tsconfig, React Navigation with a placeholder home and auth stacks, folder structure by feature (src/features/), ESLint + Prettier, dev/preview/production build scripts. No business features yet — just the scaffold every later feature lands on. Identifiers in English; UI copy in Portuguese per constitution §9.
```

> **Pencil hook**: **skip** (backend/infra). Responda "não" ao prompt do hook.

---

### 2. WatermelonDB Schema & Data Layer `[infra]` `[no-ui]`

Schema inicial das 7 entidades da R2, migrations, adapters. Nenhuma tela — só o data layer que todas as features usam.

```
/speckit-specify Set up WatermelonDB as the sole client-side data layer per constitution R1 and R2. Define the initial schema and Model classes for all seven MVP entities — salespeople, clients, products, product_variants, orders, order_items, payment_receipts — with their relationships, required columns in English, sync-friendly columns (server_id, updated_at, _status, _changed), and a migrations directory. Include a lightweight repository/adapter pattern that every feature will consume; components MUST NOT read Supabase directly.
```

> **Pencil hook**: **skip**.

---

### 3. Supabase Online Authentication (D5) `[auth]` `[ui]`

Login online, troca de tokens, persistência do refresh token no secure-store, refresh silencioso em background, tratamento de revoke.

```
/speckit-specify Implement online-one-time authentication per constitution §7 D5. Flow: email/password login screen that authenticates against Supabase Auth, exchanges for access_token + refresh_token, persists the refresh_token (never the password) in expo-secure-store (Keychain/EncryptedSharedPreferences). Background silent refresh whenever connectivity returns; 90-day TTL enforcement; on refresh failure, keep local data intact, queue the failed sync, and prompt re-login only on the next network-requiring action. No feature may call validate-token on every tap. Include a logout flow that revokes the refresh token server-side and wipes the secure-store entry.
```

> **Pencil hook**: **accept** — desenhe a tela de login, splash e estados de erro de rede.

---

### 4. Local Lock: Biometric + PIN (D6) `[auth]` `[ui]`

PIN setup no primeiro run, unlock na abertura fria e após 5min de inatividade, biometria preferida com fallback automático pra PIN.

```
/speckit-specify Implement the mandatory local lock per constitution §7 D6. First-run flow forces the salesperson to set a 4–6 digit PIN (stored hashed in expo-secure-store, never plain). Cold-start and post-inactivity (default 5min, configurable) MUST require unlock via biometrics (expo-local-authentication) when available and enrolled, with automatic fallback to the PIN screen on failure or wet-hand/dirty-sensor scenarios. PIN reset path requires full online re-login against Supabase. Local lock is complementary to D5 — it does not replace Supabase auth, only guards casual access to a lost device.
```

> **Pencil hook**: **accept** — tela de PIN setup, unlock screen (biometria + teclado PIN), reset flow.

---

### 5. Sync Engine (D1 + R1) `[infra]` `[light-ui]`

Pull-then-push, last-write-wins por timestamp, executado no login/pull-to-refresh/após criar pedido quando online. Indicador de status na home (UX4).

```
/speckit-specify Build the sync engine per constitution D1, R1, and UX4. Pull-then-push order: first pull server changes (catalog, clients, orders from other salespeople) from Supabase into WatermelonDB, then push local changes. Conflict resolution is last-write-wins by updated_at timestamp. Trigger points: on successful login, on manual pull-to-refresh from the home screen, and opportunistically after an order transitions to "sent" when connectivity is available. Expose a discreet always-on sync-status indicator for the home screen (never a modal) with states: in-sync, syncing, offline, failed. No blocking spinner on any business screen.
```

> **Pencil hook**: **accept** — pelo indicador de sync na home (UX4) + estados.

---

## Fase 2 — Dados do Core MVP

### 6. Product Catalog (first cycle do governance review) `[core]` `[ui]`

Listagem de produtos com variantes, busca rápida tap-first, imagens do Supabase Storage com cache local (R3), catálogo read-only no app (D2).

```
/speckit-specify Deliver the product catalog per constitution D2, R3, UX1, and UX3. Screens: a grid/list of products with their variants, a detail view, and a fast search bar prioritizing tap filters over typing. Catalog is strictly read-only inside the app; products are created/edited by the admin via Supabase dashboard. Product images live in Supabase Storage and MUST be cached locally through expo-file-system so the salesperson sees them offline after the first sync. First-launch empty state (no catalog pulled yet) points to the sync action in plain salesperson language, not system jargon. The constitution calls out this module as the first full spec→plan→tasks→implement cycle — scope it tightly.
```

> **Pencil hook**: **accept** — catálogo grid, detalhe do produto, busca, empty state.

---

### 7. Client Registration & Search `[core]` `[ui]`

Cadastro local de clientes (D3), listagem, busca, perfil com histórico. CNPJ duplicado → merge manual no admin (fora de escopo do app).

```
/speckit-specify Implement client management per constitution D3 and UX1. Salesperson can register a new client locally (store name, CNPJ, address, contact, notes), search the client list quickly (tap-first filters), and open a client profile that shows the order history and a primary CTA "New order". Duplicate-CNPJ detection is NOT required in the app — conflicts are merged manually by the admin in the Supabase dashboard. Support offline creation: a brand-new client persists locally and syncs when connectivity returns.
```

> **Pencil hook**: **accept** — form de cadastro, lista com busca, perfil do cliente.

---

### 8. Home Dashboard & Empty States `[core]` `[ui]`

Home do vendedor: sync status (UX4), acesso rápido a catálogo/clientes/pedidos em rascunho, empty states úteis (UX3).

```
/speckit-specify Design the salesperson's home screen as the hub per constitution UX3 and UX4. Surface the always-on sync-status indicator, quick-action cards to Catalog, Clients, and "Drafts in progress", plus the most recent activity (last sent order, last sync time). Every empty state (no catalog yet, no clients, no drafts) MUST speak in the salesperson's language and point to the next concrete step, not system errors. No modal or alert for sync — only the inline indicator.
```

> **Pencil hook**: **accept** — home desktop/mobile, cards, estados de sync.

---

## Fase 3 — Fluxo de Venda

### 9. Order Assembly + Line and Order Discounts (R5 + UX1) `[core]` `[ui]`

Montagem com tap/incremento, desconto por item e desconto total do pedido, status `draft` persistido localmente, nunca altera `product`.

```
/speckit-specify Implement order assembly per constitution R5, UX1, and D4. From a client profile, the salesperson starts a draft order, browses the catalog, taps products/variants to add with quantity inc/dec controls (no numeric keyboard for the primary path), applies an optional per-line discount (% or absolute), and an optional overall-order discount at the summary step. Discounts MUST be stored on order_item and order — NEVER mutate product prices. Draft orders persist locally across app restarts and appear in the home "Drafts in progress" list. Status transitions use only: draft, sent, canceled.
```

> **Pencil hook**: **accept** — catálogo-em-pedido, resumo, campo de desconto, drafts.

---

### 10. Repeat Last Order (UX2) `[core]` `[ui]`

Repetir o último pedido do cliente em 1–2 taps, com opção de editar antes de confirmar.

```
/speckit-specify Implement "repeat last order" as a first-class flow per constitution UX2. From a client's order history, a single tap creates a new draft cloning the last order's line items, quantities, and discounts; the salesperson lands directly on the order summary and can either send immediately or tap to edit items before sending. Maximum 2 taps from client profile to "ready to send". This flow MUST NOT be hidden inside a menu — it is a primary CTA on the client profile when history exists.
```

> **Pencil hook**: **accept** — histórico do cliente, CTA repeat, resumo pronto.

---

### 11. Order PDF Generation & Email Intent (R4) `[core]` `[ui]`

Gerar PDF do pedido localmente (expo-print), abrir share sheet / email intent com anexo, destinatário e assunto pré-preenchidos. Transitiona status para `sent`.

```
/speckit-specify Implement order-to-email delivery per constitution R4. On the order summary, a "Send" action generates a PDF locally with expo-print (no server render, no delivery service like SendGrid/Resend), then opens the device's share sheet / mail intent with the client's email in To, a pre-filled subject, a templated body, and the PDF attached. The salesperson confirms and sends from their own mail account; on return to the app, the order transitions to status "sent" with the PDF path and timestamp recorded locally. PDF template MUST include: salesperson, client, items, per-line and order discounts, totals, and a human-readable order number. No fiscal-invoice formatting — this is a quote/intent document.
```

> **Pencil hook**: **accept** — preview do PDF, dialog de send.

---

### 12. Payment Receipts `[core]` `[ui]`

Registrar recebimento (valor, método, data, foto opcional do comprovante), upload da imagem pra Supabase Storage com cache local.

```
/speckit-specify Implement payment-receipt recording against the payment_receipts entity. From an order detail, the salesperson registers a receipt with amount, method (cash, pix, transfer, check, other), date, optional notes, and an optional photo captured via camera or picked from the library. Photos upload to Supabase Storage on next sync and are cached locally via expo-file-system (same pattern as R3). Offline creation is mandatory — everything persists locally and syncs opportunistically. A receipt is append-only; corrections are new receipts with a reference back to the original.
```

> **Pencil hook**: **accept** — form de receipt, captura de foto, histórico.

---

## Fase 4 — Resiliência

### 13. Emergency Export / Local Backup (P5) `[infra]` `[light-ui]`

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
1.  Project Foundation & Navigation Shell       [infra]
2.  WatermelonDB Schema & Data Layer            [infra]
3.  Supabase Online Authentication (D5)         [auth/ui]
4.  Local Lock: Biometric + PIN (D6)            [auth/ui]
5.  Sync Engine (D1 + R1)                       [infra/light-ui]
6.  Product Catalog — first governance cycle    [core/ui]
7.  Client Registration & Search                [core/ui]
8.  Home Dashboard & Empty States               [core/ui]
9.  Order Assembly + Discounts                  [core/ui]
10. Repeat Last Order                           [core/ui]
11. Order PDF + Email Intent                    [core/ui]
12. Payment Receipts                            [core/ui]
13. Emergency Export                            [infra/light-ui]
```
