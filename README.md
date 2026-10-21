# Simple Gmail

A Chrome extension (Manifest V3) that strips Gmail down to a calm, centered inbox.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose this folder
4. Reload any open Gmail tab

## What it does

- Clean header: menu, search centred on the window, avatar — logo, apps grid, Support, Gemini and Upgrade hidden
- Left navigation hidden; the ☰ menu slides it in over the page (Esc, a folder click or a click outside closes it)
- Inbox and open emails centred in one column (Narrow / Normal / Wide), with the toolbar matched to its edges
- Mail grouped under **Yesterday / This week / Last month …** headings
- Rounded hover highlight on rows, plus a softer one replacing Gmail's blue keyboard-focus bar
- Row spacing: Tight / Comfy / Roomy
- Calendar / Keep / Tasks side panel, Mail/Chat/Meet rail, footer and importance markers hidden
- Floating **+** compose button (opens Gmail's own Compose)
- Light / Dark / Auto theme — Dark also darkens open emails; it stays off when Gmail's own theme is already dark
- Optional: toolbar hidden until needed, checkbox & star shown on hover only
- Follows your Gmail theme's colours (light or dark)
- `Alt+Shift+S` turns everything on/off (change at `chrome://extensions/shortcuts`)

Settings live in the toolbar popup and sync across your Chrome profile.
Works in Chromium browsers such as Chrome and Dia.

## Files

| File | Role |
| --- | --- |
| `content.css` | All visual changes, scoped to `html.sg-on` |
| `content.js` | Feature classes, date groups, slide-over menu, compose button |
| `popup.*` | Settings panel |
| `background.js` | Keyboard shortcut |
| `springs.css` | Spring easings generated from [Motion](https://motion.dev) |

## Animations

Hover, press, menu and page-enter animations use Motion springs, baked into CSS `linear()`
easings so they run without any JavaScript. To tweak them, edit the springs in
`scripts/generate-springs.mjs`, then:

```sh
npm install
npm run springs
```

`node_modules` is only needed for this step; the extension itself doesn't load it.
Load the extension folder as usual — Chrome ignores `node_modules`, `scripts`
and `package.json`.

## When Gmail changes

Gmail's class names are obfuscated. If something reappears after a Gmail update,
open Gmail with DevTools, find the element's new class, and update the selector
list at the top of `content.css`. A few header items (Support, Main menu,
Advanced search options) are matched by their English labels.
