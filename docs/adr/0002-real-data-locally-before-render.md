# 0002: Run the real data locally before deploying to Render

- **Date:** 2026-11-10
- **Status:** Accepted

## Context

Ticket #13 combined two pieces of work: loading the full filtered IMDb data, and deploying to Render's free tier (512 MB RAM, sleeps when idle, a per-request timeout we have not measured). Each has its own risk. The data can be too big for memory or slow to start. The deploy can hit Render's timeout or misbehave in its environment. With both in one ticket, the site can't be previewed on real data until the deploy also works.

## Decision

Split the ticket:

- **#13: real data locally.** Generate and commit the three CSV files, run the site on `localhost` against them, and measure peak memory (must stay under 512 MB) and startup time.
- **#14: deploy to Render and validate.** Deploy the free web service, check memory there, check the request timeout against the slowest Cycle searches (keep the worker or switch to background jobs, recorded in `DECISIONS.md`), and add the README note about the 15-minute sleep.

## Consequences

- The site can be previewed and presented from `localhost` on real data as soon as #13 is done.
- A memory problem shows up locally, before any deploy work.
- If something goes wrong on Render, the cause is the deploy itself, because the data and the app are already known to work.
- One more ticket to track.
