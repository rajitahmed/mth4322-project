# 0003: Host on a free Render web service from a Blueprint, with the V8 heap capped at 200 MB

- **Date:** 2026-11-11
- **Status:** Accepted

## Context

Ticket #14 deploys the site to Render's free plan (512 MB RAM, sleeps after 15 minutes idle). The real data is already committed (ADR 0002). D26 measured a startup peak of 439–468 MB on Node 23, and named `--max-old-space-size` as the first fix if Render had memory trouble.

Rerun on **Node 26**, the version local runs use and the `engines` range below picks, the uncapped peak was **482, 502 and 524 MB**. That goes over 512 MB, so D26's expectation that Render's peak would sit at or below the local one no longer holds.

## Decision

- **`render.yaml` (a Blueprint)** describes one free `node` web service: build `npm ci && npm run build`, start `npm start`. `npm ci` installs devDependencies (Vite is one), because `NODE_ENV` is not set to `production`. The server already listens on `0.0.0.0` and Render's `PORT`.
  - Alternative: set the service up by hand in the Dashboard. Rejected: the settings would live only in Render, not in the repo.
- **Node is pinned to `>=24 <27`** in `package.json` `engines`. Render advises an upper bound, and the memory numbers depend on the Node version.
- **`NODE_OPTIONS=--max-old-space-size=200`**, set in `render.yaml` only, so local runs and tests are unchanged. As D26 found, the peak is uncollected garbage: a smaller heap makes V8 collect sooner.

Measured on Node 26, Windows 11, `npm start` on the real data (peak = the process's peak working set):

| Heap cap | Startup | Peak |
|---|---|---|
| none | 7.6–8.0 s | 482–524 MB |
| 256 MB | 6.3–8.4 s | 451–489 MB |
| **200 MB** | 8.0–8.6 s | **395–484 MB** over 8 runs |
| 160 MB | 8.5–9.2 s | 334–384 MB |
| 128 MB | — | crashes: JavaScript heap out of memory |

- With the cap at 200 MB, all 3 tabs and the explainer page answered. Tab 2 was loaded with 3 Cycle searches at once, four times (3–5 random Actors, lengths 8–13). That did not raise the peak: it is always reached during startup.
- **Why 200 and not 160:** the live heap needs more than 128 MB, so a 160 MB cap leaves little heap room for requests. 200 MB keeps the peak under 512 MB in every run, with ~70 MB to spare in heap.
- **If Render's log shows a peak near 512 MB, drop the cap to 160 MB.**

## Consequences

- Each push to `main` deploys again.
- The deploy log prints `Started in … ms, memory … MB (peak … MB)`. Read the numbers on Render there and compare them with the table above.
- Waking from sleep takes about a minute (Render) plus the server's own startup, so the site has to be opened a few minutes before presenting (README).
