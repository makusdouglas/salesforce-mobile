# UI Design — Admin products CRUD

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-24

## Screens

| Screen | Frame ID | Screenshot | Notes |
|--------|----------|------------|-------|
| Admin Products List / Phone | `hq0zE` | [admin-products-list-phone.png](./admin-products-list-phone.png) | Full product list with thumbnail, name, category, base price, chevron affordance; "Novo" CTA in top bar opens the source chooser. |
| Admin Products List / Tablet | `luM9m` | [admin-products-list-tablet.png](./admin-products-list-tablet.png) | Same list with an explicit "Editar" button per row and a search field above the list. |
| Admin Product Source / Phone | `XcyOc` | [admin-product-source-phone.png](./admin-product-source-phone.png) | Modal chooser: "Cadastro manual" vs "Escanear código de barras". |
| Admin Product Source / Tablet | `1pscT` | [admin-product-source-tablet.png](./admin-product-source-tablet.png) | Tablet version of the chooser — same two options, centered card. |
| Admin Barcode Scanner / Phone | `flbRO` | [admin-barcode-scanner-phone.png](./admin-barcode-scanner-phone.png) | Camera view with framing reticle, torch toggle, and manual-entry fallback ("Digite o código manualmente"). |
| Admin Barcode Scanner / Tablet | `8l9sw` | [admin-barcode-scanner-tablet.png](./admin-barcode-scanner-tablet.png) | Tablet version with a larger reticle and wider input for manual entry. |
| Admin Barcode Match / Phone | `Po9C6` | [admin-barcode-match-phone.png](./admin-barcode-match-phone.png) | "Produto já cadastrado" state — shows the matched product with amber banner, primary CTA "Editar este produto" and secondary "Escanear outro código". |
| Admin Barcode Match / Tablet | `K1ZsP` | [admin-barcode-match-tablet.png](./admin-barcode-match-tablet.png) | Tablet layout of the match state — larger card + action buttons. |
| Admin Product Form / Phone | `ImfjY` | [admin-product-form-phone.png](./admin-product-form-phone.png) | Create/edit form: image picker drop zone, name, **barcode field with inline "Escanear"**, description, category, base price, variants list. |
| Admin Product Form / Tablet | `qmIMf` | [admin-product-form-tablet.png](./admin-product-form-tablet.png) | Split layout: image on the left, fields (incl. barcode) + variants list on the right. |
| Admin Image Source / Phone | `J9WnG` | [admin-image-source-phone.png](./admin-image-source-phone.png) | Modal chooser shown when the admin taps the image drop zone: "Tirar foto" (camera) vs "Escolher da galeria" (library), with a hint that the image is auto-reduced for storage. |
| Admin Image Source / Tablet | `ZWNU2` | [admin-image-source-tablet.png](./admin-image-source-tablet.png) | Tablet version of the chooser — same two options, centered card. |

## Components referenced

- Dashed drop zone (image picker placeholder) — custom frame using `dashPattern` stroke.
- List rows / product cards — white frames with 1px `#E4E4E7` stroke and 12–14px corner radius.
- Primary CTA — filled `#09090B` with white label (Inter 500).
- Secondary / outline chip — bordered frame with neutral foreground (Editar, Nova variante, Trocar imagem, Escanear).
- Scanner reticle — `#00000000` frame with 3–4px white stroke and 16–20px corner radius; overlay on camera preview.
- Amber banner — `#FEF3C7` fill, `#FDE68A` stroke, `#92400E` text, used for "produto já cadastrado".

## Design decisions

- Admin surfaces adopt the same neutral palette (`#FAFAFA` background, `#FFFFFF` cards, `#09090B` text, `#71717A` muted) used across the rest of the app — no dedicated admin theme.
- The Admin tab is a **peer tab**, not a mode toggle. Dual-role users see the seller home plus an extra tab; no switcher is drawn.
- "Novo" no longer opens the form directly — it opens a **Source chooser** modal so the admin picks Manual vs Barcode. This keeps the barcode fast-path one tap away without pushing it as the default.
- The barcode scanner accepts both camera scan and a typed fallback so admins can still register products when the camera is blocked (permission denied or unsupported device).
- When the scanned or typed code matches an existing product, the app routes to the **Barcode Match** screen instead of silently duplicating — the admin explicitly chooses to edit the existing product or cancel.
- When the scanned code is new, the app routes to the product form with the `barcode` field pre-filled (and visible but editable).
- Variants render as inline rows inside the form so admins can review + edit without leaving the product screen.
- The image picker shows a dashed drop zone on empty state; once a URL exists, the fill shows the image and the CTA becomes "Trocar imagem".
- Tapping the drop zone (or "Trocar imagem") opens the **Image Source** modal so the admin chooses between camera capture and photo library. The image is always downsampled to ~900 px (quality 0.7, ≈ 150–250 KB) before upload regardless of source.
- The price field keeps the `R$` prefix in the label only; the input receives a plain number so the numeric keyboard works cleanly (aligns with the existing UX1 stepper-plus-keyboard posture).

## Open questions — now resolved

- **Offline-write UX**: resolved by FR-020 + edge cases — inline Portuguese banner at the top of the form; Save stays clickable but the attempt surfaces the banner and preserves input.
- **Camera permission denied**: resolved by FR-013 — typed-entry fallback is rendered on the same scanner screen; a compact "Permitir câmera" CTA offers to re-prompt.
- **Barcode uniqueness**: resolved by FR-017 + `products_barcode_live_idx` (partial unique index on live rows).
- **Variant attribute shape**: resolved — single free-text label on the `product_variants.label` column (MVP).

## Still deferred

- Delete affordance for products and variants: recommended in design
  (trash in variant row + destructive action at bottom of form) but not
  yet an FR. Address in a follow-up feature if product retirement needs
  finer control than soft-delete via Supabase dashboard.
