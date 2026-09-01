# OpsDesk

OpsDesk is a local-first daily operations workbench for keeping tasks, technical issues, decisions, blockers, handoffs, and stakeholder updates in one structured workspace.

[Open the live app](https://andrejglavnik.github.io/projects/opsdesk/) · [Read the case study](https://andrejglavnik.github.io/projects/opsdesk/case-study.html) · [View Andrej Glavnik's portfolio](https://andrejglavnik.github.io/)

## What it does

- Captures tasks, issues, decisions, and follow-ups with operational context.
- Turns the same work items into Focus, Board, To-do, and Updates views.
- Caps the top-focus list at three items to make prioritization explicit.
- Tracks status, priority, owner, due date, blockers, notes, decisions, and handoffs.
- Keeps completed history in an archive while separating archive from permanent deletion.
- Exports stakeholder-ready reports as Excel, CSV, or Markdown.
- Exports and imports a complete JSON workspace for backup, restore, or transfer.
- Works as an installable PWA and caches its app shell for offline continuation after the first successful load.

## Privacy and local-first behavior

OpsDesk has no account, backend, analytics tracker, or automatic upload. Working data is saved in the browser's `localStorage` under the current origin. Clearing browser site data removes that local copy, so the JSON workspace export is the recovery format.

Excel, CSV, and Markdown exports are reports. Only the JSON workspace export contains the complete restorable OpsDesk and SyncDesk-compatible data model.

Browser storage is origin-scoped. The two production demos share one origin and can use the same workspace. Separate local preview servers do not share storage; move data between them with JSON export/import.

## Run locally

No build step, package manager, or framework is required.

```bash
python3 -m http.server 4180 --bind 127.0.0.1
```

Open `http://127.0.0.1:4180/`. Use an HTTP server rather than opening `index.html` directly so the service worker and PWA behavior can run normally.

## Repository structure

- `index.html` — application shell and accessible UI
- `app.css` — OpsDesk-specific presentation
- `app.js` — state, views, editing, reporting, backup, and restore behavior
- `shared/` — shared project styles, browser utilities, and workspace schema
- `shared/vendor/xlsx.full.min.js` — vendored SheetJS Community Edition browser build
- `manifest.webmanifest`, `sw.js`, `icon.svg` — installable PWA assets
- `case-study.html`, `assets/` — product case study, interactions, and preview image

## Source provenance

This standalone repository-ready copy was extracted from [`AndrejGlavnik/AndrejGlavnik.github.io`](https://github.com/AndrejGlavnik/AndrejGlavnik.github.io), path `projects/opsdesk`, at `main` commit `a2a83f34a2816a96678d1a6f078fc5f4ced521fc` on 31 August 2026. Required first-party shared files and case-study assets were copied from that same commit, and portfolio-relative paths were converted to standalone-root or live-portfolio links.

## Licensing

Licensing is intentionally scoped by material type:

- First-party application source code is available under the MIT License.
- README and case-study prose, preview images, icons, logos, the OpsDesk name, and product branding are Copyright (c) 2026 Andrej Glavnik, All Rights Reserved.
- The vendored SheetJS Community Edition 0.20.3 browser build remains under Apache-2.0.

See [`LICENSE.md`](LICENSE.md) for the exact first-party scope and MIT terms. See [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) and [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt) for SheetJS attribution and the complete Apache-2.0 text.

## Recommended GitHub About settings

- Description: `Local-first operations workbench for tasks, blockers, decisions, handoffs, status updates, and portable reporting.`
- Website: `https://andrejglavnik.github.io/projects/opsdesk/`
- Topics: `local-first`, `operations`, `project-management`, `task-management`, `support-operations`, `productivity`, `pwa`, `offline-first`, `vanilla-javascript`, `sheetjs`, `portfolio-project`
