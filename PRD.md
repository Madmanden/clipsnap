# ClipSnap — Product Requirements Document

**Version:** 1.0

**Author:** Christian Holm

**Status:** Draft

---

## Overview

ClipSnap is a Chrome extension that captures the current browser tab as an image and copies it to the clipboard instantly. Designed for developer and power-user workflows — pasting screenshots into coding agents (Claude, Cursor, etc.), emails, and chat tools.

The primary design constraint is **speed**: trigger → clipboard in one gesture, no dialogs, no friction.

---

## Goals

- Capture the visible browser tab to clipboard with a single action
- Output a PNG optimised for AI coding agent consumption (token-efficient by default)
- Provide optional resize presets via an Options page
- Lay groundwork for a future region-selection capture mode

---

## Non-Goals (v1)

- Region / area selection (v2)
- Full-page scrolling capture (v3)
- Capture delay / timer (v2)
- Save to file (v2)
- Firefox support (future)
- Publishing to Chrome Web Store (future)

---

## Users

**v1:** Single user (personal install via Developer Mode)

**Future:** Open source release; developers and power users who paste screenshots into AI coding tools

---

## v1 Feature Scope

### 1. Toolbar Button

- ClipSnap icon in the Chrome toolbar
- **Clicking the icon fires capture immediately** — no popup, no confirmation
- Options are accessed via **right-click → Options** (native Chrome behaviour)
- No `default_popup` in manifest; capture triggered via `chrome.action.onClicked`

### 2. Keyboard Shortcut

- Default: **Alt+Shift+S**
- Fires the same capture-to-clipboard action as the toolbar button
- Reassignable by the user at `chrome://extensions/shortcuts`

### 3. Capture Behaviour

- Captures the **visible area** of the active tab (not the full page)
- Output format: **PNG**
- Default resize: **Full** (native capture resolution)
- Resize is applied before writing to clipboard
- Capture is **instant** — no delay, no preview

### 4. Clipboard Output

- Image is written to the system clipboard as `image/png`
- Immediately available for pasting into any app
- **Note:** Chrome's Clipboard API only supports `image/png` for image writes; JPEG output is not possible in clipboard context. JPEG/format options are deferred to a future "save to file" feature.

### 5. Toast Notification

- Appears **top-right** of the active tab after capture
- Success state: `✓ Screenshot copied` — dark, neutral
- Error state: `✗ Failed to copy` — red tint, with brief reason if available
- Auto-dismisses after ~2.4 seconds with a fade-out animation
- No clicks required; non-blocking

### 6. Options Page

- Accessible via `chrome://extensions` or the "Options →" link in the popup
- **v1 contents:**
    - Resize preset selector (see below)
    - Keyboard shortcut display + link to `chrome://extensions/shortcuts`
    - Roadmap / coming soon section

---

## Resize Presets

| Label | Behaviour | Notes |
| --- | --- | --- |
| **Full** | Native capture resolution | Default. Fine on 1080p; large on HiDPI/Retina |
| **1280px** | Scale down to max 1280px wide | Recommended for AI coding agents |
| **960px** | Scale down to max 960px wide | Lighter; still readable for UI/code |
| **Half** | 50% of native resolution | Useful on large HiDPI displays |
- Preset is stored in `chrome.storage.sync` so it persists across sessions and devices
- Default preset on first install: **1280px**
- Downscaling only — images smaller than the target width are never upscaled
- Aspect ratio is always preserved

### Token cost context (for documentation/README)

A full Retina capture (2560px wide) costs roughly 2–3× more tokens than a 1280px capture when sent to a vision model, with no meaningful gain in readability for code or UI screenshots. The **1280px** preset is the recommended default for AI agent use.

---

## Technical Architecture

### Files

```
clipsnap/
├── manifest.json       # MV3 manifest
├── background.js       # Service worker: capture, resize, message routing
├── content.js          # Injected into pages: clipboard write, toast rendering
├── options.html        # Options page UI
├── options.js          # Options logic + chrome.storage.sync
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Manifest Permissions

```json
"permissions": ["tabs", "activeTab", "clipboardWrite", "scripting", "storage"]
```

- `storage` — for persisting the resize preset
- `scripting` — for injecting clipboard write and toast into the page context
- `clipboardWrite` — required for clipboard access

### Capture & Resize Flow

1. Trigger fires (toolbar button or keyboard shortcut)
2. `background.js` calls `chrome.tabs.captureVisibleTab()` → returns a PNG data URL
3. Background reads the active preset from `chrome.storage.sync`
4. If preset is not **Full**, background injects a resize script via `chrome.scripting.executeScript`:
    - Draws the image onto an offscreen `<canvas>` at target dimensions
    - Exports as PNG blob
5. Clipboard write is executed in the page context (required — Clipboard API is not available in service workers)
6. Toast is injected and rendered in the page context

### Known Constraints

- Capture does not work on `chrome://` pages, `chrome-extension://` pages, or the Chrome Web Store — Chrome restricts script injection there. Toast will not appear; a fallback Chrome notification could be added in v2.
- `captureVisibleTab` captures the visible viewport only, not off-screen content.
- HiDPI screens: Chrome captures at the physical pixel resolution (e.g. 2× on Retina). The **1280px** preset handles this gracefully.

---

## v2 Backlog

| Feature | Notes |
| --- | --- |
| Region / area selection | Content script overlay with drag-to-select; dimmed background (low opacity) with bright selection rect cutout; crops before clipboard write |
| Capture delay (1s / 3s / 5s) | Lets user set up UI state before capture fires |
| Save to file | Downloads PNG or JPEG to disk; JPEG compression slider |
| JPEG output | Only meaningful for file save; clipboard remains PNG |
| Format selector | PNG / JPEG / WebP in Options, applies to file save |
| Restricted page fallback | Chrome notification when tab injection is blocked |

## v3 Backlog

| Feature | Notes |
| --- | --- |
| Full-page scrolling capture | Stitches multiple viewports; complex, likely needs a library |
| Chrome Web Store publish | Requires privacy policy, store assets, review process |

---

## Decisions Log

| Question | Decision |
| --- | --- |
| Default resize preset | **1280px** — better for AI agent use; configurable in Options |
| Region selection overlay style | Dimmed background (~40% opacity dark overlay), bright/clear selection rectangle cutout, crosshair cursor |

---

## Success Criteria (v1)

- [ ]  Capture fires in under 500ms from trigger to clipboard
- [ ]  Toast appears and auto-dismisses reliably on standard `http/https` pages
- [ ]  Resize presets produce correct output dimensions and are persisted across sessions
- [ ]  Works correctly on 1080p and HiDPI (Retina) displays
- [ ]  Options page is accessible and functional
