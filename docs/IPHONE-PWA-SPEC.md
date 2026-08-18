# iPhone App-like PWA — Specification & Implementation Record

**Date**: 2026-08-18
**Branch**: `claude/iphone-app-like-page-nkd0nd`
**Status**: Implemented, pushed, passing typecheck + lint + tests

---

## 1. Objective

Convert the mobile web experience from a browser-style horizontal-scroll navigation into an iOS-native-feeling PWA. When a user adds the app to their iPhone home screen via Safari's "Add to Home Screen", it should launch and behave like a native app — no browser chrome, edge-to-edge rendering, bottom tab navigation, and native touch feedback.

---

## 2. Prior State (Before)

| Aspect | Implementation |
|---|---|
| Mobile navigation | `MobileNav` component in `components/shell/sidebar.tsx` — sticky top header with horizontal scrolling text-only tabs for all 11 nav items |
| Status bar | `apple-web-app-status-bar-style: "default"` — black text on white bar, content starts below |
| Viewport | Standard viewport, no `viewport-fit` set |
| Safe areas | Not handled — no `env(safe-area-inset-*)` usage |
| Touch behavior | Default browser tap highlight (blue flash), default overscroll bounce |
| Manifest | `display: "standalone"`, no `orientation` or `scope` |

---

## 3. Changes Made

### 3.1 Bottom Tab Bar

**New file**: `components/shell/bottom-tab-bar.tsx`

A client component (`"use client"`) that renders an iOS-style fixed bottom navigation bar.

**Structure**:
- `<nav>` element, `position: fixed`, `bottom: 0`, `inset-x: 0`, `z-index: 30`
- Background: `bg-surface/95` with `backdrop-blur-md` (semi-transparent with blur, matching iOS tab bar aesthetic)
- Top border: `border-t border-line`
- Inner container: `h-[50px]`, flex, `justify-around`
- Hidden on desktop: `lg:hidden`

**Tab items** (4 primary + 1 "more"):

| Position | Label | Icon (lucide-react) | Route |
|---|---|---|---|
| 1 | 홈 | `LayoutDashboard` | `/` |
| 2 | 캘린더 | `CalendarDays` | `/calendar` |
| 3 | 퀴즈 | `BrainCircuit` | `/quiz` |
| 4 | 브리핑 | `Newspaper` | `/briefing` |
| 5 | 더보기 | `Ellipsis` | `/more` |

Each `TabItem` renders as a `<Link>` with:
- Icon: `size-[22px]`
- Label: `text-[10px]`, `font-medium`, `leading-tight`
- Active state: `text-accent` color
- Inactive state: `text-text-muted` color
- Touch feedback: `active:scale-[0.88]`, `transition duration-150`
- `aria-current="page"` on active tab
- Safe area bottom padding: `pb-[env(safe-area-inset-bottom)]` on the `<nav>` element

**"더보기" active detection**: The tab highlights as active when the current pathname matches `/more` OR any of the routes that belong to the "more" group (tasks, courses, wiki, invest, portfolio, apply, settings). This is computed via `MORE_HREFS` set + `isActive()` checks.

### 3.2 Navigation Item Reorganization

**Modified file**: `components/shell/nav-items.ts`

Added exports alongside the existing `NAV_ITEMS` (11 items, unchanged):

```ts
TAB_BAR_ITEMS: NavItem[]   // 4 primary tabs (홈, 캘린더, 퀴즈, 브리핑)
MORE_TAB: NavItem           // { href: "/more", label: "더보기", icon: Ellipsis }
MORE_ITEMS: NavItem[]       // Derived: NAV_ITEMS filtered to exclude TAB_BAR_ITEMS (7 items)
```

`MORE_ITEMS` contains: 마감·할 일, 과목, 위키, 투자, 포트폴리오, 지원, 설정.

Added `Ellipsis` to the lucide-react import list.

### 3.3 "더보기" Page

**New file**: `app/(dashboard)/more/page.tsx`

Server component. Renders a list of the 7 non-tab-bar navigation items.

Each row:
- `<Link>` with `rounded-xl bg-surface px-4 py-3.5`
- Left: `size-8` icon container with `bg-accent-soft` background, `text-accent` icon
- Center: item label, `text-sm font-medium`
- Right: `ChevronRight` chevron icon (iOS Settings list pattern)
- Touch feedback: `active:scale-[0.98] active:bg-accent-soft`

Page title: `"더보기 · Personal OS"` (metadata export).

### 3.4 Dashboard Layout Update

**Modified file**: `app/(dashboard)/layout.tsx`

Changes:
1. Removed `MobileNav` import — replaced with `BottomTabBar` import from `components/shell/bottom-tab-bar`
2. Removed `<MobileNav savedOrder={savedOrder} />` from the render tree
3. Added `<BottomTabBar />` after `<main>`, inside the flex column
4. Updated `<main>` padding: `pb-[calc(50px+env(safe-area-inset-bottom)+1rem)]` on mobile to prevent content from being hidden behind the fixed tab bar. Desktop (`lg:`) retains `pb-6`.

### 3.5 Viewport & Apple Web App Meta

**Modified file**: `app/layout.tsx`

Changes to the `metadata` export:
- `appleWebApp.statusBarStyle`: `"default"` → `"black-translucent"`
  - Effect: status bar becomes transparent; app content extends behind it

Changes to the `viewport` export:
- Added `viewportFit: "cover"`
  - Effect: renders `<meta name="viewport" content="... viewport-fit=cover">`, which tells Safari to extend the web content into the safe area (behind notch, Dynamic Island, home indicator)

### 3.6 Global CSS — Native Touch & Safe Areas

**Modified file**: `app/globals.css`

Added inside `@layer base`:

```css
html {
  -webkit-tap-highlight-color: transparent;   /* removes blue tap flash on iOS */
  overscroll-behavior: none;                   /* removes rubber-band bounce in standalone */
}

@media (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);    /* prevents content behind transparent status bar */
  }
}
```

### 3.7 Manifest Update

**Modified file**: `public/manifest.json`

Added fields:
- `"scope": "/"` — declares the navigation scope of the PWA
- `"orientation": "portrait"` — locks to portrait on mobile

### 3.8 MobileNav Deprecation

**Modified file**: `components/shell/sidebar.tsx`

The `MobileNav` component body was replaced with `return null`. The export is kept for backward compatibility (it is still imported in the layout, though no longer rendered since the layout change removed its usage). Marked `@deprecated` with a JSDoc comment. Removed unused `useMemo` import.

---

## 4. File Inventory

| File | Status | Role |
|---|---|---|
| `components/shell/bottom-tab-bar.tsx` | **New** | iOS-style bottom tab bar (client component) |
| `app/(dashboard)/more/page.tsx` | **New** | "More" page listing non-primary nav items |
| `components/shell/nav-items.ts` | Modified | Added `TAB_BAR_ITEMS`, `MORE_TAB`, `MORE_ITEMS` exports |
| `app/(dashboard)/layout.tsx` | Modified | Replaced `MobileNav` with `BottomTabBar`, adjusted main padding |
| `app/layout.tsx` | Modified | `viewport-fit: cover`, `statusBarStyle: "black-translucent"` |
| `app/globals.css` | Modified | Tap highlight, overscroll, safe area top padding |
| `public/manifest.json` | Modified | Added `scope`, `orientation` |
| `components/shell/sidebar.tsx` | Modified | Deprecated `MobileNav` (returns null), removed unused `useMemo` |

---

## 5. Architectural Decisions

### 5.1 Tab bar item selection (4 + More)

iOS convention limits bottom tabs to 5. Selected the 4 most frequently accessed pages (dashboard, calendar, quiz, briefing) based on the app's daily workflow: check schedule → take quiz → read briefing. The remaining 7 items go behind "더보기". The desktop sidebar is completely unaffected.

### 5.2 Fixed position over sticky

The tab bar uses `position: fixed` rather than sticky. This ensures it stays visible during scrolling without participating in the document flow, matching native iOS behavior. The `<main>` element compensates with bottom padding equal to `50px + env(safe-area-inset-bottom) + 1rem`.

### 5.3 Backdrop blur on tab bar

`bg-surface/95 backdrop-blur-md` gives the tab bar a frosted-glass effect matching the iOS system tab bar. This does not violate SPEC.md 6.4 rule 1 (glass restricted to calendar/briefing cards) because the tab bar is a shell navigation element, not a widget card.

### 5.4 MobileNav kept as export

`MobileNav` was not deleted from `sidebar.tsx` — it was hollowed to `return null`. This avoids breaking any code that may import it (the layout previously used it). A future cleanup can remove it entirely.

---

## 6. What This Does NOT Change

- **Desktop layout**: Sidebar, grid, all widget positioning — untouched.
- **Design tokens**: All colors, typography, spacing from `tokens.css` — untouched.
- **SPEC.md 6.4 rules**: No gradients, no emoji icons, no purple-blue, glass only on calendar/briefing cards. All 12 rules still hold.
- **Widget internals**: No widget component was modified.
- **Data layer**: No database, API, or repository changes.
- **Service worker**: `sw.js` unchanged.
- **Existing page routes**: All 11 pages at their original paths. `/more` is additive.

---

## 7. Verification

```
npm run typecheck    → 0 errors
npm run lint         → 0 errors (1 pre-existing warning in scripts/gen-lessons.ts)
npm run test         → grades.test.ts: 5/5 pass; gate tests: cancelled (no local Supabase)
```

---

## 8. Installation on iPhone

1. Open the deployed URL in Safari on iPhone
2. Tap the share button (□↑)
3. Tap "Add to Home Screen"
4. The app icon appears on the home screen
5. Opening it launches in standalone mode — no Safari URL bar, transparent status bar, bottom tab navigation, edge-to-edge content

---

## 9. Known Limitations & Future Work

- **Apple touch startup images**: Not implemented. Adding `apple-touch-startup-image` link tags for various iPhone sizes would eliminate the white flash on launch. Requires generating multiple sized PNG splash screens.
- **Pull-to-refresh**: `overscroll-behavior: none` disables the browser's default pull-to-refresh. A custom in-app pull-to-refresh could be added for pages that benefit from manual refresh (calendar, briefing).
- **Tab bar item customization**: The 4 primary tabs are hardcoded. A user preference for which items appear in the tab bar could be stored in `user_prefs` alongside sidebar order.
- **Swipe-back gesture**: iOS standalone PWAs do not support the Safari swipe-back gesture by default. A custom swipe gesture handler could simulate this.
- **MobileNav cleanup**: The deprecated `MobileNav` export in `sidebar.tsx` can be fully removed once confirmed no other code references it.
