# Movie Statistics (MTH4322)

Full-stack app over a filtered IMDb dataset (feature films, rating >= 6.1, votes >= 1,100). Actors are linked when they share a movie. Three operations: largest finite shortest path, shortest cycle through k actors, and Six Degrees of Bacon. Spec: `brief.md`. Design: `design.md`.

## AI rules (from the brief)

- **`DECISIONS.md`**: record every algorithmic decision with a full explanation of why it was chosen, the alternatives, and the running time. See `docs/agents/domain.md`.
- **`chat_log.md`**: append one entry after **every** request, in chronological order. Each entry has the date, what was asked, and what was done/decided.

## Code principles

All generated code must be clean and composable, and follow **SOLID, KISS, DRY and YAGNI**:
- Small, single-purpose modules and functions, composed together. The 3 operations sit behind one module (brief), which takes its dependencies (the graph) as inputs.
- The simplest thing that works. No speculative abstractions, config, or "for later" code.
- One source of truth for shared logic (for example, BFS is written once and reused by every operation).

Stack: TypeScript everywhere (see `docs/adr/0001-typescript-everywhere.md`).

Data: three CSV files shipped with the app: `movies.csv` (id, title, year, rating, votes), `actors.csv` (id, name, birth_year, so autocomplete can tell actors with the same name apart), and `credits.csv` (movie_id, actor_id). The tiny test dataset uses the same three files and the same loader.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `rajitahmed/mth4322-project` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/` (architecture), plus root `DECISIONS.md` (algorithms). See `docs/agents/domain.md`.
