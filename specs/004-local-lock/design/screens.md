# UI Design — Mandatory Local Lock

**Source**: [layout.pen](../../../layout.pen)
**Captured**: 2026-04-20
**Design system**: **shadcn/ui (light)** — inherited from 003 auth screens. Reuses the same token palette (`#FFFFFF` background, `#18181B` primary, `#F4F4F5` muted, `#E4E4E7` border, `#71717A` muted-foreground) and `Inter` typeface already shipped by 003 for visual coherence across the app's gating surfaces (login → PIN setup → lock).

## Screens

| Screen | Viewport | Frame ID | Screenshot | Intent |
|--------|----------|----------|------------|--------|
| PinSetup | Phone | `jDrHn` | [pinsetup-phone.png](./pinsetup-phone.png) | First-run PIN setup, `entering` sub-step with 4 of 6 dots filled to show mid-entry state + step badge "Passo 1 de 2". Maps to User Story 1, FR-001–FR-004. |
| PinSetup | Tablet | `mfbb4` | [pinsetup-tablet.png](./pinsetup-tablet.png) | Same contract, 460 pt centered card, 64×64 wordmark, Inter 30 heading. Maps to User Story 1. |
| Lock | Phone | `Xiob1` | [lock-phone.png](./lock-phone.png) | Lock screen with SALESFORCE wordmark, "Face ID tentado" pill (indicates biometric attempt happened and fell through), 3 dots filled, disabled "Desbloquear" button, "Esqueci meu PIN" ghost below card. Maps to User Story 1, FR-005–FR-008, FR-013. |
| Lock | Tablet | `t3bCe` | [lock-tablet.png](./lock-tablet.png) | Same contract, 460 pt centered card, Inter 30 wordmark. Maps to User Story 1. |
| PinRecoveryConfirm | Phone | `Td2wY` | [pinrecoveryconfirm-phone.png](./pinrecoveryconfirm-phone.png) | Bottom-sheet modal over the dimmed lock screen — key icon, "Redefinir PIN" heading, reassurance copy, two bullets (requires internet / data stays), primary "Continuar" + ghost "Cancelar". Maps to User Story 3, FR-013, FR-014, FR-015. |
| PinRecoveryConfirm | Tablet | `qIHxR` | [pinrecoveryconfirm-tablet.png](./pinrecoveryconfirm-tablet.png) | Dialog central sobre fundo escurecido, 460 pt, same contract. Maps to User Story 3. |

## Components referenced

- **PinPad** — 3×4 numeric grid composed ad-hoc inside PinSetup and Lock cards: 9 digit keys (1–9), blank slot, `0`, backspace (`feather/delete` icon). Phone variant: 56 pt key height, 8 pt radius, 10 pt gap, Inter 22/500 labels. Tablet variant: 64 pt key height, 10 pt radius, 12 pt gap, Inter 26/500 labels. To be promoted to a reusable [`PinPad`](../contracts/screens.md) primitive during [T011](../tasks.md) implementation.
- **Card** (same as 003) — `cornerRadius: 12` (phone) / `16` (tablet), `fill: #FFFFFF`, `stroke: #E4E4E7` 1 pt, `padding: 24` (phone) / `32` (tablet). Reuses 003's `Card` component (task T008 already shipped).
- **Button (primary)** — `fill: #18181B`, `colors.primaryForeground #FAFAFA` text, Inter 14 (phone) / 15 (tablet) 500. Reuses 003's `Button/Default` primitive.
- **Button (disabled primary)** — `fill: #F4F4F5`, `colors.mutedForeground #A1A1AA` text. Shown on the lock screen's "Desbloquear" when PIN length < 4.
- **Button (ghost)** — no fill, `colors.mutedForeground #71717A` text. Reused for "Esqueci meu PIN", "Cancelar".
- **Pill badge** — `fill: #F4F4F5`, `cornerRadius: 9999`, padding `[0, 10]` (phone) / `[0, 12]` (tablet), Inter 11/500 (phone) / 12/500 (tablet). Used for "Passo 1 de 2" (PinSetup) and "Face ID tentado" (Lock).
- **PIN dot** — `ellipse` 14×14 (phone) / 16×16 (tablet). Filled = `#18181B`, empty = `#FFFFFF` + `#E4E4E7` 1 pt stroke.
- **Bottom-sheet modal** (phone) — grip bar 40×4 rounded, card `cornerRadius: [20, 20, 0, 0]`, over dimmed `#0A0A0AB3` backdrop. Reuses 003's Relogin phone pattern.
- **Centered dialog** (tablet) — card `cornerRadius: 16`, 1 pt `#E4E4E7` border, over dimmed `#0A0A0AB3` backdrop. Reuses 003's Relogin tablet pattern.

## Design decisions

- **Reuse of 003's shadcn light palette** (rather than the `Anchored Ribbon Grid / Lavender Cream / Funnel Sans` style guide configured globally). Rationale: 003 shipped first and established the app's gating visual language; PIN setup and lock screens visually chain from Login (same card, same wordmark, same primary-black CTA). Forking the palette here would create two competing aesthetics on adjacent screens of the same flow. If/when the global style guide is adopted, 003 + 004 migrate together.
- **Biometric is OS-owned, not drawn on the canvas** — the biometric prompt is a native OS modal (`expo-local-authentication.authenticateAsync`). The Lock frame shows the PIN-pad resting state after biometric was attempted. The "Face ID tentado" pill is a one-time subtle acknowledgement that the biometric path was already tried and the user is now in the fallback PIN path — keeps the screen minimal (FR-020) while communicating the state.
- **Lock/Phone PIN dots show 3 of 6 filled** (mid-entry) + disabled "Desbloquear" button — communicates the progressive-delay + minimum-length interaction contract at a glance (button enables at ≥ 4 digits per FR-016 curve). PinSetup/Phone shows 4 of 6 filled + enabled "Avançar" — the confirm-step entry point.
- **Single "happy-path" state per frame** — we did not draw the offline-recovery warning state, the progressive-delay countdown state, or the confirm step of PinSetup as separate frames. Those are deterministic variants of the frames here: offline recovery just disables "Continuar" and shows the "Conecte-se..." hint; countdown disables the keypad with a timer below the dots; PinSetup confirm step swaps heading to "Confirme seu PIN" and the step badge to "Passo 2 de 2". Documenting as a single frame per logical screen keeps the file proportional to its value.
- **Tablet uses a 460 pt centered card** (same decision as 003) rather than splitting the viewport in two — the lock is a security gate, not a dashboard; visual minimalism aligns with FR-020.
- **No wordmark on PinSetup** (just the lock icon + "Crie seu PIN" heading) vs. **wordmark SALESFORCE on Lock** — the setup flow is a one-time interstitial right after login; the lock screen is the daily cold-start surface and wears the brand. Differentiating the two reduces banner fatigue.
- **"Esqueci meu PIN" lives OUTSIDE the card as a ghost button** — intentionally deprioritized visually (it's the escape hatch, not the happy path). Same weight treatment as 003's Relogin "Cancelar".

## Open questions for the spec

None surfaced during the design session. All six frames render within budget on both viewports; the spec and plan are not affected.
