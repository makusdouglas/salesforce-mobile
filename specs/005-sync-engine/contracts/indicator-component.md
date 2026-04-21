# Contract: `<SyncStatusIndicator>` *(inline component)*

Single-row, tap-inert, layout-neutral React Native primitive. Lives in `src/features/sync/components/SyncStatusIndicator.tsx`. Mounted by the home screen (and, in the future, any screen designated by UX4 — for MVP, only the home screen).

---

## Signature

```text
type Props = {
  /** Optional host-supplied style. Component does NOT own horizontal margin. */
  style?: StyleProp<ViewStyle>
}

function SyncStatusIndicator(props?: Props): JSX.Element
```

---

## Visual states

Four states, four rows. Each row is a 32-pt-tall horizontal `View` with an icon, a 4-pt gap, and a Portuguese label. No border, no background. The whole indicator is a single inline run — it flows alongside host content, it does not occupy its own strip.

| `status` | Icon | Icon color | Label *(PT)* | Label color |
|----------|------|-----------|-------------|-------------|
| `in-sync` | ✓ check | `tokens.colors.successForeground` | `Dados em dia` | `tokens.colors.textSecondary` |
| `syncing` | spinner (activity indicator, small) | `tokens.colors.textSecondary` | `Sincronizando…` | `tokens.colors.textSecondary` |
| `offline` | ⊘ cloud-off | `tokens.colors.textTertiary` | `Sem internet` | `tokens.colors.textTertiary` |
| `failed` | ⚠ alert-triangle | `tokens.colors.warningForeground` | `Falha ao sincronizar` | `tokens.colors.warningForeground` |

Specific choices:

- The `failed` state uses the **warning** palette, not the **error** palette — FR-013/FR-016 say the indicator is discreet. Error red would compete with in-app errors (auth rejections, validation messages) that the salesperson needs to notice. Warning is noticeable without being alarming.
- `syncing`'s spinner uses the native `<ActivityIndicator size="small" />`. No custom rotation. Platform-consistent.
- Label font: `typography.bodySmall` from the 001/003 tokens. 14 pt on phone, 14 pt on tablet (no size scaling — the indicator reads the same at both viewports, which is what lets us skip separate Pencil frames).

All icons are drawn from the existing 003 icon set (`lucide-react-native`, already a transitive dep). No new icon library.

---

## Accessibility

```text
<View
  accessibilityRole="text"
  accessibilityLabel={accessibilityLabelFor(status)}
  style={[styles.row, style]}
>
  <Icon />
  <Text>{labelFor(status)}</Text>
</View>
```

- `accessibilityRole="text"` — screen readers announce the label text, not a button.
- `accessibilityLabel` matches the visible label (no hidden text).
- Not focusable in keyboard navigation (not a control).

The component does not implement a `onPress` — per FR-013/FR-016, the indicator is strictly informational. Pull-to-refresh is a host-screen gesture, not a tap on the indicator.

---

## Responsive strategy *(why no Pencil frames)*

The component renders identically on:

- **Phone** (390 × 844 pt) — occupies roughly 160 pt of width at `Dados em dia`; sits in the header row with the screen title.
- **Tablet** (820 × 1180 pt) — same 160 pt width; the host places it at the right edge of its header, flowing with the wider layout.

No breakpoint branches inside the component. No viewport-dependent props. Width is intrinsic (icon + text); height is fixed at 32 pt. Horizontal padding is the host's business.

The constitution's UX5 ("phone AND tablet frames") applies to screens, not to a 32-pt inline primitive with zero layout alternatives. The Phase-0 Design Prerequisite gate in plan.md records this as component-only (N/A for screen-level frames) and points here for placement metrics.

---

## Host-screen integration

```text
// In HomePlaceholderScreen.tsx (and any future home screen)
<View style={styles.header}>
  <Text style={styles.title}>Home</Text>
  <SyncStatusIndicator style={styles.indicator} />  // host positions via style
</View>
```

Conventionally the host places it right-aligned in the header row with `marginStart: 'auto'`. Any host margin/padding is the host's choice; the indicator contributes nothing.

---

## Non-props, non-features

- **No `size` prop.** The 32-pt height is part of the contract. If a future feature wants a larger variant, that's a new component — not a variant prop that introduces inconsistency.
- **No `onPress` prop.** The indicator does not respond to taps. UX4 explicitly says it is not a modal-opener.
- **No `details` expansion.** Tapping it does not reveal "last synced 3 minutes ago" or any such detail. If that telemetry becomes necessary later, surface it in a Settings screen (deferred; not in MVP scope).
- **No badge or count.** The four states are exhaustive (FR-014). We do not show pending-change counts.
- **No custom color override.** The tokens are the palette; if the host needs a different look (e.g., a dark-mode home screen), that's a theme-level concern, not a per-mount override.

---

## Testing

- **Visual**: render the component in each of the four states in a storybook/test-host and verify the icon + label match the table above. Not exhaustive because the logic is a small switch.
- **Snapshot**: light snapshot per state (one per) to catch accidental token changes.
- **Accessibility**: `accessibilityLabel` matches the label text for each state.

The bulk of the feature's testing is in the store/derive/resolver tests, not on this view.
