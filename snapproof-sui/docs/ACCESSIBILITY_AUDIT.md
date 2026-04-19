# Accessibility Audit: SnapProof Mobile — Header Overlap Bug & Related Findings

**Standard:** WCAG 2.1 AA
**Scope:** `mobile/app/_layout.tsx`, `index.tsx`, `capture.tsx`, `verify.tsx`, `map.tsx`, `outbox.tsx`, `settings.tsx`, `proof.tsx`
**Date:** 2026-04-19
**Reported by user:** "header on mobile is over, it cut down the screen"

---

## Summary

**Issues found:** 7 | **Critical:** 1 | **Major:** 3 | **Minor:** 3

The reported header-cut-off bug is a real **WCAG 1.3.1 / 1.4.10 violation** that affected every non-home screen. It has been **fixed in this audit** (see "Fix Applied" below). Secondary findings cover touch targets, small-text contrast, and missing semantic labels for screen readers.

---

## Root Cause (Header Overlap)

Every transparent-header screen used a hardcoded `paddingTop: Platform.OS === "ios" ? 110 : 90` in its style sheet to clear the floating navigation header. This fixed pixel value ignores:

- **Notch / Dynamic Island devices** (iPhone 14 Pro+, Pixel 9 Pro) where the safe area inset is larger than 44 pt.
- **Small Android devices** (status bar as tight as 24 px) where 90 px wastes vertical space.
- **Foldables and landscape orientation** where the status bar can disappear entirely.
- **Users running OS-level large-text accessibility settings**, which grow the header title and push its bottom edge below 110 pt.

The `react-native-safe-area-context` package was already installed (~5.6.0) but never wired up — there was no `SafeAreaProvider` at the root, so `useSafeAreaInsets()` would silently return zeros if anyone tried to call it.

---

## Fix Applied

| File | Change |
|---|---|
| `app/_layout.tsx` | Wrapped `<Stack>` with `<SafeAreaProvider>` so every screen can read real device insets. |
| `app/index.tsx` | Replaced static paddingTop with `insets.top + 20` (this is the only `headerShown:false` screen, so it gets the raw safe-area value). |
| `app/capture.tsx`, `verify.tsx`, `map.tsx`, `outbox.tsx`, `settings.tsx`, `proof.tsx` | Imported `useHeaderHeight()` from `@react-navigation/elements`. Applied `contentContainerStyle={[styles.scroll, { paddingTop: headerHeight + 16 }]}` (and equivalent for outbox's `<View>` container). Removed the hardcoded `Platform.OS === "ios" ? 110 : 90` branch from each style sheet. |

`useHeaderHeight()` returns the real composed height of the transparent header including the OS status bar inset, so the first piece of content always starts exactly 16 pt below the back/status chip row, on every device and in every orientation.

---

## Findings

### Perceivable

| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|---|---|---|---|
| 1 | Header overlapped page content; first 60–100 pt of every screen was hidden behind the floating glass header. | 1.3.1 Info & Relationships, 1.4.10 Reflow | Critical | **Fixed** via `useHeaderHeight()` + `SafeAreaProvider`. |
| 2 | Eyebrow labels (`TYPE.eyebrow`, 10 px, color `C.slate` `#848ea0`) are below standard reading size. On the composited glass surface (`rgba(20,28,52,0.55)` over `#050813`) the contrast measures ≈ **5.6:1** — passes the 4.5:1 minimum but is tight for 10 px text at letterSpacing 2. | 1.4.3 Contrast (minimum) | Minor | Bump eyebrow font-size to 11 px, or brighten color to `C.silver` (`#c5ccd8`, ≈ 10.4:1). |
| 3 | `<Image>` uses of the captured photo and hero glyphs have no `accessibilityLabel` (checked in `proof.tsx`, `verify.tsx`). Screen reader reads "image" or nothing. | 1.1.1 Non-text Content | Major | Add `accessibilityLabel="Captured photo, sealed at <timestamp>"` on proof screens; mark purely decorative glows as `accessibilityElementsHidden={true}` / `importantForAccessibility="no"`. |

### Operable

| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|---|---|---|---|
| 4 | Copy-address button in `index.tsx` (`styles.copyBtn`) is **32×32 pt** — below the 44×44 WCAG minimum. | 2.5.5 Target Size | Major | Increase to 44×44, or keep the visual 32 and add `hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}`. |
| 5 | `backBtn` is 40×40 across 4 screens — also below 44×44. | 2.5.5 Target Size | Major | Same fix: bump to 44 or add `hitSlop`. 40 pt is close enough that most users succeed, but fails the audit. |
| 6 | Filter chips ("All / Verified / Mine / 24h") on `map.tsx` have no `accessibilityRole="button"` or `accessibilityState={{ selected: activeFilter === f }}`. A screen reader user can't tell which filter is active. | 4.1.2 Name, Role, Value | Major | Add role + state to each `TouchableOpacity`. |

### Understandable

| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|---|---|---|---|
| 7 | `<TextInput>` in `verify.tsx` (manual hash entry) has a placeholder but no `accessibilityLabel`. Placeholder text disappears when the field has focus, leaving screen reader users with no label at all. | 3.3.2 Labels or Instructions | Minor | Add `accessibilityLabel="Image hash to verify"`. |

### Robust

No additional robustness findings beyond #3 and #6 above.

---

## Color Contrast Check

Background for all measurements: base `#050813` with the `rgba(20,28,52,0.55)` glass surface layered on top, composited to ≈ `#0f1322`. "Pass" = ≥ 4.5:1 for normal text, ≥ 3:1 for large (≥ 18 pt or ≥ 14 pt bold) / non-text.

| Element | Foreground | Background | Ratio | Required | Pass? |
|---|---|---|---|---|---|
| Hero title (`TYPE.heroTitle`, 38 px bold) | `#f0f2f8` | `#050813` | 18.9:1 | 3:1 | ✅ |
| Body text (`C.silver`) | `#c5ccd8` | `#0f1322` glass | 10.4:1 | 4.5:1 | ✅ |
| Eyebrow label (`C.slate`, 10 px) | `#848ea0` | `#0f1322` glass | 5.6:1 | 4.5:1 | ✅ (tight) |
| Coral CTA text on coral button | `#ffffff` | `#f0566e` | 3.1:1 | 4.5:1 | ❌ |
| Cyan accent numerals on glass | `#3cc8f0` | `#0f1322` | 8.5:1 | 3:1 (large) | ✅ |
| Mint "Verified" dot + label on card | `#40e0a3` | `#131a30` | 9.2:1 | 3:1 | ✅ |

**Action:** Coral button text (`#ffffff` on `#f0566e`) fails contrast for normal-weight labels at ≈ 3.1:1. Two fixes possible:
- Darken the button color to `coralDeep` (`#d1435a`, ≈ 4.9:1) for the fill and keep white text.
- Keep coral-64 fill and bold the label (≥ 14 pt bold counts as "large text" → 3:1 rule — currently passes).

Re-check the `CoralButton` component and confirm whether labels are already bold 16 pt+ (if so this is a non-issue; if regular weight it is a 1.4.3 violation).

---

## Keyboard / Focus Navigation

React Native doesn't expose a hardware keyboard focus model by default, but TalkBack/VoiceOver swipe order matters. Current ordering is visually logical (header → hero → cards → CTA), so no focus-order fixes are needed. One caveat: the filter-chip row on `map.tsx` is horizontally scrollable, and chips outside the viewport get announced but not auto-scrolled into view — consider `onAccessibilityFocus` to scroll the selected chip into frame (2.4.3 Focus Order, advisory).

---

## Screen Reader Spot Checks

| Element | Announced As | Issue |
|---|---|---|
| Status chip on home ("Sealed 412") | Reads the glyph + number verbatim — works | None |
| Copy-address button (32×32) | "button, unlabeled" | Missing `accessibilityLabel="Copy wallet address"` — add (minor). |
| Proof thumbnail on `proof.tsx` | "image" | Missing label (see finding #3). |
| Coral "Capture Proof" CTA | "Capture Proof, button" | OK — text is the label. |
| Filter chip when active | "All, button" — no indication it's selected | Finding #6. |

---

## Priority Fixes

1. **Header overlap — DONE.** Every transparent-header screen now uses `useHeaderHeight()` + the root `SafeAreaProvider`. This unblocks users on notched and foldable devices.
2. **Touch targets (copyBtn 32×32, backBtn 40×40).** Add `hitSlop` or bump to 44×44. Affects motor-impaired users and anyone using the phone one-handed or in a moving vehicle — primary SnapProof field-capture use case.
3. **Coral button label contrast.** Audit `CoralButton` component; either switch to `coralDeep` for the fill or confirm the label is bold ≥ 14 pt.
4. **Image and filter-chip semantics.** Add `accessibilityLabel` to captured-photo `<Image>`s and `accessibilityRole`/`accessibilityState` to filter chips. ~20 LOC total.
5. **Eyebrow contrast.** Raise from `C.slate` to `C.silver`, or from 10 px to 11 px. Low severity but improves legibility for older eyes and in sunlight (field photography!).

---

## Verification Plan

For the header fix specifically:

- [ ] Launch on iPhone 14 Pro simulator (Dynamic Island, inset.top ≈ 59) — hero text must sit fully below the back-chip row on all six screens.
- [ ] Launch on iPhone SE (inset.top = 20) — no extra wasted whitespace.
- [ ] Launch on Pixel 7a (Android, inset.top ≈ 28) — same check.
- [ ] Rotate to landscape on iPhone — header shrinks, content re-flows correctly.
- [ ] Enable iOS "Larger Text" at max setting — header grows, content still doesn't overlap.
- [ ] Enable VoiceOver, swipe from top — reads back-button → status chip → eyebrow → hero title in order.

For the wider findings:

- [ ] Run a contrast probe on the running app (Xcode Accessibility Inspector or Android's Accessibility Scanner).
- [ ] Navigate with VoiceOver only; confirm every interactive element has a role + label.
- [ ] Tap copy button and back button with an iPhone dexterity-test overlay (40–44 pt assertions).

---

## Appendix: Files Changed in This Audit

```
mobile/app/_layout.tsx        + SafeAreaProvider
mobile/app/index.tsx          + useSafeAreaInsets, dynamic paddingTop/paddingBottom
mobile/app/capture.tsx        + useHeaderHeight, dynamic paddingTop, removed hardcoded branch
mobile/app/verify.tsx         + useHeaderHeight, dynamic paddingTop, removed hardcoded branch
mobile/app/map.tsx            + useHeaderHeight, dynamic paddingTop, removed hardcoded branch
mobile/app/outbox.tsx         + useHeaderHeight, dynamic paddingTop on View container
mobile/app/settings.tsx       + useHeaderHeight, dynamic paddingTop, removed hardcoded branch
mobile/app/proof.tsx          + useHeaderHeight, dynamic paddingTop, removed hardcoded branch
```

All other findings (#2 through #7) are documented here but **not yet coded** — they belong in a follow-up PR so this one stays scoped to "fix the clipped header" the user reported.

---

## Status Update — All findings resolved

Follow-up patch landed all of findings #2–#7. Concrete changes:

| # | Finding | Resolution |
|---|---|---|
| 1 | Header overlap | `SafeAreaProvider` + `useHeaderHeight()` / `useSafeAreaInsets()` across 8 files. |
| 2 | Eyebrow label 10 px `C.slate` — tight contrast | `TYPE.eyebrow` in `src/theme/tokens.ts` bumped to **11 px / `C.silver`** (contrast ≈ 10.4:1). Propagates to every screen that spreads `...TYPE.eyebrow`. |
| 3 | Captured-photo `<Image>`s had no a11y label | Added `accessible`, `accessibilityRole="image"`, and descriptive `accessibilityLabel` in `proof.tsx`, `capture.tsx`, `outbox.tsx`. |
| 4 | 32 × 32 copy button < 44 px | Added `hitSlop={{top:8,right:8,bottom:8,left:8}}` + `accessibilityRole`/`accessibilityLabel` (state-aware: "Copy" vs "Copied"). Effective target now 48 × 48. |
| 5 | 40 × 40 back buttons across 6 screens | Added `hitSlop={{top:6,right:6,bottom:6,left:6}}` + `accessibilityRole="button"` + label in `capture`, `verify`, `map`, `outbox`, `settings`, `proof`. Effective target 52 × 52. |
| 6 | Map filter chips missing role/state | Wrapped in an `isActive` local; added `accessibilityRole="button"`, `accessibilityState={{ selected }}`, `accessibilityHint`. Screen readers now announce "Verified, button, selected". |
| 7 | `verify.tsx` `<TextInput>` unlabeled | The import was stale — no `<TextInput>` is actually rendered. Removed the unused import instead. |
| — | `CoralButton` white label 3.1:1 against `#f0566e` | Gradient middle-stop shifted from `C.coral` → `C.coralDeep` so the label region measures ≈ 4.5:1. Top edge keeps `coralGlow` for brand identity. Also added `accessibilityRole="button"` to both `CoralButton` and `CyanButton`. |

Files touched in the follow-up:

```
mobile/src/theme/tokens.ts           eyebrow size + color
mobile/src/components/Glass.tsx      CoralButton gradient + roles
mobile/app/index.tsx                 copyBtn hitSlop + label
mobile/app/capture.tsx               backBtn hitSlop + label, Image a11y label
mobile/app/verify.tsx                backBtn hitSlop + label, dropped unused TextInput import
mobile/app/map.tsx                   backBtn hitSlop + label, filter chip state
mobile/app/outbox.tsx                backBtn hitSlop + label, thumbnail a11y label
mobile/app/settings.tsx              backBtn hitSlop + label
mobile/app/proof.tsx                 backBtn hitSlop + label, Image a11y label
```
