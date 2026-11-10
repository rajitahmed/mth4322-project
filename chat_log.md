# Chat Log

A chronological log of how this application is being built. There is one entry per request; inside each entry, the discussion appears in the order it happened.

---

## 2026-11-10: Agent skills setup

- **Asked:** Read `brief.md` and set up the repo config for Matt Pocock's engineering skills.
- **Explored:** The repo has a GitHub remote (`rajitahmed/mth4322-project`). There was no `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`, `docs/` or `.scratch/`. The `triage` skill is installed. It is a single app, not a monorepo.
- **User's choices:**
  - Issue tracker: **GitHub**.
  - Triage labels: **the defaults**.
  - Config file: create **`CLAUDE.md`**.
  - Decisions: **both** `DECISIONS.md` and `docs/adr/`. `DECISIONS.md` must hold the algorithmic decisions, each with a full explanation of why.
- **Done:**
  - Created `CLAUDE.md` (project summary, the brief's AI rules, the Agent skills block).
  - Created `docs/agents/issue-tracker.md` (GitHub), `docs/agents/triage-labels.md` (default labels), and `docs/agents/domain.md` (single-context; `DECISIONS.md` for algorithms, `docs/adr/` for architecture).
  - Created `DECISIONS.md` (template) and `chat_log.md`.

---

## 2026-11-10: Algorithm grilling, operation 1 (largest finite shortest path)

- **Asked:** Decide which algorithms to use for each operation in `brief.md`, explain why, and work through them one by one, starting with operation 1.
- **Framing:** The actor graph has one node per Actor and a Link between two Actors who share a Movie. The **largest finite shortest path** is the largest Distance between two Actors in the same Group, which is the largest diameter across all connected components. Pairs in different Groups have no finite Distance and are ignored.

**Q1: Weighted or unweighted Distance?**
- **Proposed:** unweighted. Every Link counts as 1 movie. "Shortest path" means the fewest links (the same counting as Six Degrees). Ratings belong to tab 3. Unweighted lets us use BFS in O(V + E) per search instead of Dijkstra's O(E log V).
- **User:** Agreed. Every edge is a distance of 1 (one movie apart), so unweighted makes sense and lets us use BFS.
- **Done:** Created `CONTEXT.md` with Movie, Actor, Link, Distance, Group, and Largest finite shortest path. "Group" was chosen because the brief already says "separate groups of actors."

**Q2: Which algorithm for the database-wide answer?**
- **Options:**
  - Naive BFS from every actor: O(V·(V+E)), about 10⁹–10¹⁰ steps, minutes to hours, offline only.
  - iFUB (Crescenzi et al., 2013): exact, the same worst case, but usually a few dozen BFS runs on real-world graphs.
- **Proposed:** iFUB, run on every Group (a small Group can have a larger diameter than the main one).
- **User:** Agreed that iFUB is better, since running BFS from thousands of actors would take far too long. Asked how the central actor is chosen.
- **Correction given:** Either algorithm runs only once. The naive one is ruled out because that one run takes hours.

**Q3: How is the central actor chosen?**
- **Explained:** The center only affects speed; iFUB is correct from any start.
- **The 4-sweep:**
  - Start at the actor with the most links. Run BFS and take the farthest actor, a₁. Run BFS from a₁ to get b₁. Take the midpoint r₂ of the a₁→b₁ path.
  - Repeat from r₂ to get a₂, b₂ and the center u, the midpoint of a₂→b₂.
  - The sweeps also give a starting lower bound `lb`.
- **Stopping rule explained:** Layers Lᵢ are taken from u and processed from the outside in. Stop when lb > 2(i−1), because any two actors left unchecked are within 2(i−1) of each other.
- **Proposed:** the 4-sweep, starting from the most-linked actor (deterministic, from the paper, only 4 extra BFS runs).
- **User:** Agreed, the 4-sweep works.

**Q4: Actor–actor graph or actor–movie graph?**
- **Options:**
  - Actor–actor graph (clique expansion): p(p−1)/2 edges per movie, and each edge needs a list of movies.
  - Actor–movie (bipartite) graph: one edge per credit. Search steps Actor → Movie → Actor, Distance = steps ÷ 2, and each Movie is expanded once per search.
- **Proposed:** actor–movie. Several times fewer edges (which matters for the 512 MB limit and iFUB's many BFS runs), the movie chain comes free in the path, and ratings sit on Movie nodes for tab 3.
- **User:** Agreed. It is much faster, with far fewer edges.

**Q5: Plain or bidirectional BFS for the optional two-actor search?**
- **Proposed:** bidirectional BFS. Each round, the side with fewer actors at its edge expands one full layer, and the searches stop when they meet. It explores roughly √ as much, which keeps the "explored and rejected" animation payload small (plain BFS can explore most of the database), and two searches meeting reads well on a projector.
- **User:** Agreed.

**Q6: What happens with ties?**
- **Proposed:** The **distance is the answer**, and the pair and chain are one example. Tests check the distance and that the chain is valid, not a specific pair. Ties go to the lowest actor id. The tiny dataset has exactly one farthest pair.
- **User:** Agreed. The distance is what gets validated.

**Q7: When is the database-wide answer computed?**
- **Options:** when the server starts, on the first click (then kept), or in the offline data script.
- **Proposed:** when the server starts. One code path serves both tests and production, and the extra time is hidden because the site is opened before presenting anyway. It can move into the data file later if needed.
- **User:** When the server starts.

**Q8: What does the tab 1 animation show?**
- **Options:**
  - Replay bidirectional BFS between the two endpoints iFUB found.
  - Animate iFUB itself: dozens of full BFS runs, huge payloads, a second visual style.
- **Proposed:** the replay, because the brief says both tab-1 searches must "look the same." iFUB is explained by the presenter.
- **User:** Option 1.

- **Summary confirmed by the user.**
- **Done:** Wrote D1–D5 in `DECISIONS.md`.

---

## 2026-11-10: Algorithm grilling, operation 2 (shortest cycle)

- **Framing:** The shortest simple cycle through k chosen actors is NP-hard (it includes Hamiltonian cycle when k = every actor). The brief allows non-polynomial time and no time limit, but the site must still work on a free 512 MB server in front of a class.

**Q1: What counts as a Cycle, and how is it measured?**
- **Proposed:**
  - Length = number of Links = number of actors on the Cycle.
  - It may pass through other actors, never repeats an actor, and may reuse a Movie. For example, Ann, Bob and Cat all in *Heat* give a valid 3-Cycle.
  - On the actor–movie graph, "visited" is tracked for Actors only, because a reused Movie revisits its node.
- **User:** Asked whether the cycle must pass through the k chosen actors. Agreed with the recommendation.
- **Clarified:** Yes, it **must** visit all k. It **may also** pass through other actors to connect them (for example, Ann – Dan – Bob – Cat – Ann).
- **Done:** Added **Chosen Actor** and **Cycle** to `CONTEXT.md`.

**Q2: What is the core search?**
- **Options:**
  - Brute force over all cycles: hopeless.
  - Fix the order, then join consecutive actors with paths that share no actor: that subproblem is itself NP-hard.
  - IDA*: k BFS runs for exact distances, then DFS from Chosen Actor #1 with a length budget L, pruning when the length so far plus a lower bound on the finish is more than L. L goes up by 1 each pass, and the first Cycle found is the shortest.
  - An ILP solver: a heavy black box with nothing to animate.
- **Proposed:** IDA*. Exact with a one-line proof, reuses BFS and the actor–movie graph, course material, and the pruned branches become the red animation links.
- **User:** Agreed.

**Q3: What checks run first, and should the search space be restricted?**
- **Proposed, in order:**
  1. Different Groups → fully red with a reason.
  2. No shared biconnected block → fully red, naming the cut actor. Blocks are those of the actor graph: Tarjan's blocks of the actor–movie graph, merged where only a Movie joins them. Computed once at startup.
  3. Run IDA* inside that block only.
  4. L goes past the block size → fully red, "no cycle exists without repeating an actor" (possible even within one block when k ≥ 3).
- **User:** Agreed.

**Q4: What does the Cycle animation get?**
- **Options:** everything explored (megabytes of noise); the final pass only, capped at ~300 rejected branches with a "cut short" flag; or the Cycle only (no red).
- **Proposed:** the final pass, capped. The "+ N more branches tried" note doubles as a talking point about pruning.
- **User:** Option 2.

**Q5: Ties and tests?**
- **Proposed:**
  - The answer is the length, or the reason category.
  - Validity checks on the Cycle: all Chosen Actors present, no repeats, every Link backed by a real Movie, the Cycle closes.
  - Neighbors are tried in order of lowest id.
  - A reused Movie is shown on each Link.
  - Add a cut-actor test case to the tiny dataset.
- **User:** Agreed.

**Q6: How are long searches handled, given no time limit?**
- **Options:** a plain synchronous request (blocks the server), a separate worker within one request, or a background job with polling.
- **Proposed:** a separate worker, and check Render's request timeout before presenting.
- **User:** Option 2, but keep option 3 in mind.

- **Summary confirmed by the user.**
- **Done:**
  - Wrote D6–D9 in `DECISIONS.md`.
  - Corrected D4's wording: with full-layer expansion and meeting checks at discovery, the first meeting is already shortest. The real pitfall is the node-by-node variant that checks when a node is removed from the queue.
  - Created `algorithms.md`, a study guide for operations 1 and 2.
  - Rewrote this log to record the whole discussion so far.

---

## 2026-11-10: Algorithm grilling, operation 3 (Six Degrees of Bacon)

**Q1: Does best-rated change the Layers or only the chain?**
- **Options:** Layers stay as BFS distance and best-rated only picks among shortest chains; or best-rated redefines the Layers.
- **Proposed:** Layers stay the same. "Six degrees" means Distance, and the brief's test asks for different *links*.
- **User:** Option 1, with no need to change what Six Degrees means.
- **Done:** Added **Center** and **Layer** to `CONTEXT.md`.

**Q2: What makes a chain "best-rated"?**
- **Options:** highest average rating (= highest sum, since all candidates have the same length); or best worst movie (bottleneck), where ties are common.
- **Proposed:** highest average, ties to the lowest id, computed by DP Layer by Layer: best(v) = max [best(p) + rating(m)].
- **User:** Option 1. Asked exactly how it is a DP pattern.
- **Explained:**
  - Outward-only links form the shortest-path DAG, which has no cycles.
  - Subproblem: best(v).
  - Optimal substructure: the prefix of a best chain is a best chain, by the swap argument.
  - Overlapping subproblems: best(p) is reused by many actors in the next Layer.
  - Layer order is a topological order. Choices are stored to rebuild chains.
  - Worked example: Kevin / Ann / Bob / Cat with *Apollo 13*, *Heat*, *Footloose*, *Ronin*.
  - This is "longest path in a DAG," linear on a DAG though NP-hard in general. On the actor–movie graph: movies first, then actors, O(A + M + C).

**Q3: How do results reach the browser?**
- **Options:** send everything (several MB); send a summary and look up chains on click; or recompute on every click.
- **Proposed:** a summary (Layer counts, ring samples, can't-be-linked count) plus a chain lookup per click from the cached result, with a paged, searchable can't-be-linked list.
- **User:** Option 2.

**Q4: Ties and tests?**
- **Proposed:**
  - Shortest-link = BFS parents (lowest id).
  - Best-rated ties go to the lowest id.
  - The answer is the Layer sets, the can't-be-linked set, and chain length (+ total rating).
  - Chains get validity checks.
  - The tiny dataset has an actor whose two chains differ and an actor who can't be linked.
- **User:** Agreed. Base the answer on Layers, can't-be-linked, chains, and links, tested on the tiny dataset.

**Q5: When does it run, and how many results are kept?**
- **Options:** Kevin Bacon at startup plus a small cache for others; compute every time; or precompute every actor (impossible in 512 MB).
- **Proposed:** Kevin Bacon at startup, others on request, keep the last ~8.
- **User:** Option 1.

- **Summary confirmed by the user.**
- **Done:** Wrote D10–D12 in `DECISIONS.md`, added section 6 (Operation 3) and new cheat-sheet rows to `algorithms.md`, and updated this log.
- **Next:** The user asked to turn everything into tickets with `/to-tickets` if no other decisions remain. Flagged the remaining open decisions before ticketing: tech stack and data file format.

---

## 2026-11-10: Stack and data format

**QA: Which language and framework?**
- **Options:** TypeScript everywhere (Node + Fastify, typed-array CSR graph, Vite + canvas front end, Vitest); a Python FastAPI back end; or Python with NumPy/SciPy.
- **Proposed:** TypeScript. iFUB's many searches and IDA*'s exponential search make Python's 10–50× slowdown decisive. Typed arrays fit in 512 MB. One language gives shared types.
- **User:** Option 1, for speed. Generated code must be clean and composable and follow SOLID, KISS, DRY and YAGNI.
- **Done:** Wrote `docs/adr/0001-typescript-everywhere.md`. Added a "Code principles" section, the stack, and the data format to `CLAUDE.md`.

**QB: What format is the data file?**
- **Options:** three CSV files (movies, actors, credits); SQLite (needs a native module and is loaded into memory anyway); or a single JSON file (larger, memory-hungry to parse).
- **Proposed:** three CSV files. No dependencies, the tiny dataset can be written by hand, and one loader serves tests and production. `actors.csv` includes `birth_year` so autocomplete can tell actors with the same name apart.
- **User:** Option 1, three CSV files.

- **Next:** Turn everything into implementation tickets (`/to-tickets`).

---

## 2026-11-10: Push and tickets

- **Asked:** Turn everything into tickets (`/to-tickets`) and push the current state to GitHub.
- **Done:** Committed all docs and pushed to `main` on `rajitahmed/mth4322-project` (commit `18c65dd`).
- **Not done:** `/to-tickets` can only be started by the user, not by Claude. The user needs to type `/to-tickets` at the prompt.

---

## 2026-11-10: Tickets published

- **Asked:** `/to-tickets`. Turn the plan into implementation tickets.
- **Proposed:** 13 tickets, each a complete working feature: (1) project setup + tiny dataset + graph + autocomplete; (2) IMDb data script; (3) tab 1 two-actor path; (4) tab 1 largest path; (5) tab 3 Layers; (6) tab 3 best-rated + cache; (7) tab 2 checks; (8) tab 2 IDA*; (9) enter screen; (10) animation engine + tab 1 animation; (11) tab 2 animation; (12) tab 3 rings; (13) real data + Render deploy. The optional explanation page was left out (YAGNI).
- **User:** Approved. Ticket 1 fits in one session.
- **Done:** Published GitHub issues #1–#13 with the `ready-for-agent` label, in dependency order, with GitHub's native "blocked by" relationships. Ready to start: #1. After #1: #2, #3, #5, #7, #9 can run in parallel.

---

## 2026-11-10: Ticket #1 implemented (project setup, tiny dataset, graph, autocomplete)

- **Asked:** `/implement` ticket #1. Record every decision in `DECISIONS.md` and every AI activity in `chat_log.md`.
- **Read:** issue #1, `CLAUDE.md`, `CONTEXT.md`, ADR 0001, `DECISIONS.md` D1–D12, `brief.md`, `design.md`, and the later tickets (#2, #3, #9, #13), so that the interfaces line up with them.
- **Set up the project:** Node + Fastify server, a plain TypeScript + Vite web app, and Vitest with happy-dom for the two DOM tests. npm first installed Vitest 3.2.7, which has published security advisories (tinypool, @vitest/mocker), so it was pinned to **4.1.12** (released 2026-10-15, patched). npm 10.9.2 crashed on Vitest 4's optional peer set (an arborist `edgesOut` bug), so that one install was run with npm 11.6.2. Afterwards `npm install` and `npm audit` work on npm 10 and report 0 vulnerabilities.
- **Tiny dataset (`data/tiny/`):** 17 Actors, 16 Movies, 2 Groups, designed to cover every case in the ticket. Paper answers are in `data/tiny/ANSWERS.md`. The Spec reviewer recomputed all of them by hand and found no errors.
  - Unique farthest pair: Pia Holt to Xia Ortiz, Distance 7.
  - Cut actor: Dev Ennis.
  - Cycle that needs Movie reuse: "Heat, Again" with 3 Actors.
  - k = 6 Cycle: a ring of six Actors.
  - Shortest and best-rated chains differ for Xia Ortiz.
  - Same-name Actors: two Sam Lees, born 1970 and 1988.
  - Missing birth year: Uma Jones.
  - Group 2 can't be linked to Kevin Bacon.
- **Built (tests first, red then green):**
  - CSV parser (handles quoted fields).
  - Dataset loader.
  - CSR helper and the actor–movie graph in `Int32Array`s.
  - Union-find Group labels.
  - Autocomplete index.
  - The operations module `createOperations(graph)`.
  - The `GET /api/actors?q=&limit=` endpoint.
  - The web shell: 3 tabs, plus actor fields per tab that accept only an Actor picked from the list and show `Name (birth year)`.
- **Decisions recorded:**
  - **D13:** rows in file order define "lowest id"; CSR built by counting sort with sorted rows; Group labels by union-find rather than BFS, which keeps a single BFS in the codebase for ticket #3.
  - **D14:** autocomplete uses a sorted array of word-start keys with binary search, ranked by Movie count, then name, then row. Alternatives were a linear scan, a trie, and substring matching.
  - Not algorithmic, so only logged here: data folder from `DATA_DIR` (default `data/tiny` until ticket #13); server serves `dist/web`; colors from `design.md` defined as CSS variables now so ticket #9 reuses them.
- **Code review (`/code-review`, two parallel reviewers):**
  - **Standards:** no hard violations. Fixed: a shared `Csr` type and `row()` helper replaced the duplicated CSR indexing in `graph.ts` and `groups.ts`; both search limits now live in `operations.ts`; Movie counts come from `moviesOf`; ranking ties compare normalized names; a failed search now shows no suggestions instead of an unhandled error (new test). Left as is: the `Actor = ActorSummary` alias (keeps the domain term); `NaN` checks on numbers and blank lines in CSV files (the data script, ticket #2, controls its output).
  - **Spec:** every acceptance criterion met, every paper answer verified. Minor extras: the `limit` parameter, ranking, and a README with run instructions.
- **Verified:** `npm run typecheck` clean; `npm test` runs 28 tests and all pass; `npm run build` OK; the real server loaded the tiny CSVs (17 Actors, 16 Movies, 2 Groups) and served `/api/actors` and the page.
- **Committed** to `main`.

---

## 2026-11-10: Ticket #2 implemented (IMDb data script)

- **Asked:** `/implement` ticket #2. Record every decision in `DECISIONS.md` and every AI activity in `chat_log.md`.
- **Read:** issue #2 (and #13, which later commits the real CSV files), `CLAUDE.md`, `CONTEXT.md`, `DECISIONS.md` D13–D14, the CSV parser, the dataset loader and the graph builder (which rejects credits naming an unknown Actor or Movie).
- **Built (tests first):**
  - `src/data/imdbFilter.ts`: `filterImdb(sources)` takes the four IMDb files as streams of lines and returns the Dataset. It runs one streaming pass per file: ratings (≥ 6.1 from ≥ 1,100 votes), then basics (title type `movie`), then principals (`actor`/`actress` of kept Movies, once per Movie), then names. Ids are sorted by their number, as D13 needs.
  - `formatCsv` in `src/server/csv.ts` and `writeDataset` in `src/server/dataset.ts`, next to the parser and loader, so the file format lives in one place.
  - `src/data/main.ts`, run with `npm run data`: downloads the four `.tsv.gz` files from `datasets.imdbws.com` into `data/imdb-raw/` (gitignored; a file already there is reused; a download goes to a `.part` file first) and writes `data/imdb/`.
  - `Movie.year` is now `number | null`, like birth year, because IMDb has undated titles.
  - README: a "Data" section on how to run the script.
- **Tests:** each acceptance criterion has its own test: a Movie below 6.1, one under 1,100 votes, a TV movie, short, video and episode, and crew who are not actors (director, writer, `self`). Further tests cover numeric id order (`nm9999999` < `nm10000000`), duplicate roles, credits whose Actor has no name, CSV quoting, and an end-to-end test (filter, write, load, build the graph).
- **Decision recorded: D15.** The filter is a streaming hash join, one pass per file in dependency order. Alternatives were loading everything into memory (`title.principals` has ~10⁸ rows), SQLite or DuckDB, pandas, and a sort-merge join. Time O(R + B + P + N), space O(R' + M + A + C).
- **Code review (`/code-review`, two parallel reviewers):**
  - **Standards:** fixed: `filterImdb` split into one function per pass; `castOf` renamed `actorIdsOf` (CONTEXT.md avoids "cast member"); `optional` renamed `formatOptional`; `!` assertions removed from `main.ts`. Left as is: `writeDataset` stays beside `loadDataset`, so both CSV directions sit in one module; the TSV row reader is separate from the CSV parser because the formats differ (no quoting in IMDb TSV).
  - **Spec:** every criterion met. Fixed: an Actor whose name is `\N` is now dropped (new test), and the end-to-end test was added for "the output loads with the loader".
- **Real run:** downloaded the four files (~1.3 GB, about 7 min), then filtered them (about 8 min). Output: **29,705 Movies, 119,458 Actors, 271,435 credits**. `loadDataset` and `buildGraph` load it in 0.9 s and find 846 Groups; Kevin Bacon is `nm0000102`; every Movie has a year, rating ≥ 6.1 and votes ≥ 1,100. The CSV files were **not committed**: ticket #13 does that.
- **Verified:** `npm run typecheck` clean; `npm test` 37 tests, all pass.
- **Committed** to `main`.

---

## 2026-11-10: Pushed ticket #2 and closed it

- **Asked:** push the work and close ticket #2.
- **Done:** pushed `main` (`b779b39`) to GitHub and closed issue #2 with a comment linking the commit, the real-run counts and D15.

---

## 2026-11-10: Ticket #3 implemented (tab 1: shortest path between two Actors)

- **Asked:** `/implement` ticket #3. Record every decision in `DECISIONS.md` and every AI activity in `chat_log.md`.
- **Read:** issue #3, `DECISIONS.md` D1, D2, D4, D13, `algorithms.md` §4, `data/tiny/ANSWERS.md`, `design.md` (result line, fully red "not possible"), `CONTEXT.md`, and the existing graph, operations, API and web code.
- **Built (tests first, at the operations seam, then the API, then the tab):**
  - `src/server/bfs.ts`: the one BFS in the codebase. `startSearch`, `expandFrontier` (moves the whole frontier out by one Link, Actor → Movie → Actor, and returns the new Actors in index order), and `chainTo` (walks the parents back).
  - `src/server/shortestPath.ts`: bidirectional BFS on top of it. The side with the smaller frontier steps (side a on a tie), meetings are checked on the newly reached Actors and the shortest wins (lowest index on a tie), and an empty frontier means "no path". It returns the Distance, the chain, and the explored Links (from, Movie, to, side).
  - `operations.shortestPath(a, b)` maps indices to ids (`ShortestPath`, `MovieSummary`, `ExploredLink`, `SearchSide` in `src/shared/types.ts`); an unknown id throws `UnknownActorError`.
  - `GET /api/path?a=…&b=…`: 404 for an unknown Actor (mapped in the API's error handler), 400 for a missing one.
  - `src/web/pathPanel.ts`: tab 1 now has the two Actor fields, `[enter]`, and a 24px result line, `distance 4: Kevin Bacon — Open Road — Ada Hart — …`, or a fully red `no path: these actors share no chain of movies`.
- **Tests:** paper answers Kevin → Dev = 4 and Pia → Xia = 7, a check that each chain is valid (right endpoints, right length, no repeated Actor, every Movie has both Actors), Distance 1 and 0, the lowest-id tie chain, different Groups → no path, explored Links are real and include the chain, unknown id; API 200/404/400; the panel's result line, red "no path", a failed request, and nothing before both Actors are picked.
- **Decision recorded: D16.** One BFS stepped one Link at a time and reused by every operation; each side marks its own Movies; meetings are checked on Actors only; tie rules; explored Links = the two search trees (not every Link looked at, to keep the payload small); errors.
- **Real data check:** ten pairs of well-known Actors take 2–7 ms each and explore 250–680 Links. Kevin Bacon → Leonardo DiCaprio = 2 (via Brad Pitt: *Sleepers*, *Once Upon a Time in... Hollywood*).
- **Code review (`/code-review`, two parallel reviewers):**
  - **Standards:** no hard violations. Fixed: renamed `expandLayer` → `expandFrontier` and `source` → `start` (CONTEXT.md ties Layer to the Center and avoids "source"); one `SearchSide` type instead of `"a" | "b"` four times; the 404 moved out of the operations module into the API's error handler; renamed `actor`/`movie` helpers to `actorAt`/`movieAt` (they were shadowed); the test file builds the graph once; the panel's `search` parameter is now `searchActors`. Left as is: `shortestPath.ts` keeps its own index-based `ExploredLink`/`PathResult` (the server works in indices, the shared types in ids).
  - **Spec:** every criterion met and the bidirectional BFS judged correct. Fixed: the panel now shows "search failed, try again" (plain ink, not red, since red means only "not possible") when the request fails; `MovieSummary` trimmed to id and title (year and rating were unused, YAGNI). Left as is: explored Links are the search trees only (D16 explains why); the lowest-id tie test stays, because D13 requires the same pair to always give the same chain.
- **Verified:** `npm run typecheck` clean; `npm test` 53 tests, all pass; `npm run build` OK.
- **Committed** to `main`.

---

## 2026-11-10: Ticket #4 implemented (tab 1: largest finite shortest path, iFUB + 4-sweep)

- **Asked:** `/implement` ticket #4. Record every decision in `DECISIONS.md` and every AI activity in `chat_log.md`.
- **Read:** issue #4, `DECISIONS.md` D3, D5, D13, D16, `algorithms.md` §3, `data/tiny/ANSWERS.md`, `brief.md` (tab 1), `design.md`, `CONTEXT.md`, and the existing BFS, bidirectional BFS, operations, API and tab 1 code.
- **Built (tests first, at the operations seam, then the API, then the tab):**
  - `src/server/bfs.ts`: `searchLayers`, a full search that loops the existing `expandFrontier` to the end and returns each Distance's Actors. BFS is still written once.
  - `src/server/largestPath.ts`: iFUB with a 4-sweep start. The 4-sweep starts from the Actor with the most Links (distinct co-stars, lowest id on ties), then sweeps a₁ → b₁, takes the midpoint r₂, sweeps a₂ → b₂ and takes the midpoint u. iFUB then searches the layers from u, outermost first, and stops when lb > 2(i−1). Every Group that could still reach the best is searched, biggest first. A Group of n Actors is skipped once n − 1 < best. Ties go to the exact lowest-id pair.
  - `operations.largestPath()`: computed once when the operations module is created (at server start), together with the bidirectional BFS between the two endpoints (the chain and explored Links for the animation). The result is cached. New shared type `FoundPath`. The id mapping moved into one `pathBetween` helper used by both path operations.
  - `GET /api/largest-path` returns the cached result. `main.ts` logs the Distance and how long it took at startup.
  - Tab 1: a `[largest path]` button (no fields to fill in) puts `distance 7: Pia Holt — Lone Star — …` on the same result line as the two-actor search.
- **Tests:**
  - Operations: the tiny dataset's paper answer, Distance 7, Pia Holt → Xia Ortiz, with a valid chain. The explored Links equal a bidirectional BFS replay between the endpoints. A smaller chain Group beats a bigger star Group, and pairs across Groups are ignored. Ties go to the lowest id across Groups.
  - iFUB (Distance and pair) matches a BFS from every Actor on 200 seeded random graphs. Endpoints share a Group at exactly that Distance. A single Actor gives Distance 0.
  - API: 200 with Distance 7 and the chain, and one result computed once.
  - Panel: the button shows the full chain, and a failed request shows "search failed".
- **Real data check:** Distance **12**, Óscar Acúrcio ↔ Abolfazl Ahankhah (Portuguese cinema → Mastroianni → Greek → Iranian cinema). The 4-sweep already finds 12. iFUB checks layers 7 and 6 from u (423 searches) to prove it. About 430 searches, ~14 s at startup, against ~113,778 for the naive method. The response is ~325 KB (4,681 explored Links).
- **Decision recorded: D17.** It covers the Group order and size bound, the exact lowest-id tie rule and why it needs no extra searches, Links counted as distinct co-stars, the midpoint, `searchLayers`, the chain cached at startup (a change to D5's per-request replay), the endpoint, and the measurements. D5 now points to D17.
- **Code review (`/code-review`, two parallel reviewers):**
  - **Spec:** iFUB was judged correct. One real gap: the first draft kept the *first* pair found at the best Distance, not the lowest-id pair (D5, issue #4). **Fixed** with the exact lowest-id rule (D17). The size skip became `<` instead of `≤` so a Group that could tie is still searched. New tests cover this: a cross-Group tie, and the random-graph check now compares the pair too. Putting the old `≤` back makes both tests fail. Left as is: the startup log (a single line, useful when presenting), and the chain cached at startup instead of per request (recorded in D17).
  - **Standards:** **Fixed** "diameter" (on CONTEXT.md's avoid list) in code and test names, with `groupDiameter` renamed to `groupLargestPath`. Also fixed "all-sources" wording in the tests, and the confusing `largest`/`largestReplay` names (now `farthestPair`/`farthestChain`; the panel's button is `largestButton`). The two `{ distance: -1, … }` copies became one `NO_PAIR`. D5 now points to D17. Left as is: `searchLayers` uses "Layer" for any start Actor (D16 already does this), `linkCount` passed through to `mostLinked`, the small Dataset builders in two test files (different shapes), and the `[largest path]` button sharing the tab's name (the brief puts the no-input answer on this tab).
- **Verified:** `npm run typecheck` clean, `npm test` 64 tests all pass, and `npm run build` OK.
- **Committed** to `main`.

---

## 2026-11-10: Ticket #5 implemented (tab 3: Six Degrees Layers and shortest-link chain)

- **Asked:** `/implement` ticket #5. Record every decision in `DECISIONS.md` and every AI activity in `chat_log.md`.
- **Read:** issue #5, `DECISIONS.md` D10, D12, D13, D16, D17, `algorithms.md` §6, `data/tiny/ANSWERS.md` (operation 3), `design.md` (tab 3), `CONTEXT.md`, and the existing BFS, operations, API and tab 1 code.
- **Built (tests first, at the operations seam, then the API, then the tab):**
  - `src/server/sixDegrees.ts`: `layersAround(graph, center)` runs the existing `searchLayers` (BFS is still written once). It keeps the search, the Layers, and the Actors it never reached (the can't-be-linked set).
  - `src/server/recentCache.ts`: an 8-entry least-recently-used cache built on a `Map`.
  - Operations:
    - `sixDegrees(center)` returns the full answer: every Layer's Actors and the can't-be-linked Actors.
    - `layerSummary(center)` returns the Layer counts and the can't-be-linked count.
    - `chainToCenter(center, actor)` returns the BFS parent chain, or `{ found: false }`.
    - `unlinked(center, q, offset, limit)` returns a paged, searchable list.
    - The default Center is the Actor named exactly "Kevin Bacon", computed at startup. Other Centers go through the cache.
  - Shared `Chain` type (`FoundPath` extends it) and `IndexChain`. One `chainOf` mapping and one `chainText` serve both tabs. `actorSearch.ts` exports `nameMatcher`, so the list search uses the autocomplete's rule.
  - Endpoints: `GET /api/six-degrees`, `/api/six-degrees/chain`, `/api/six-degrees/unlinked`. `center` is optional (Kevin Bacon), an unknown id gives 404, and a missing Actor or a bad page gives 400.
  - Tab 3: center field (starts at Kevin Bacon), actor field, `[enter]`. It lists `layer i: count` and `can't be linked: n`. The result line shows `layer 2: Kevin Bacon — Low Tide — Sid Moss — Low Tide 2 — Xia Ortiz`, or a red `can't be linked: …`.
  - `CONTEXT.md`: new term "Can't be linked".
- **Tests:**
  - Operations:
    - The paper Layer sets around Kevin Bacon match.
    - Group 2 is can't-be-linked and in no Layer.
    - Every Actor's chain is valid and as long as their Layer number.
    - Xia's chain goes through Sid (lowest ids).
    - Another Center works, and so does the default.
    - The summary's counts are right.
    - Paging and name search of the list work.
    - Unknown ids are rejected.
    - A dataset with no Kevin Bacon falls back to its first Actor.
  - Cache: computes a key once and drops the least recently used.
  - API: all three endpoints, plus 404/400.
  - Panel:
    - It starts around Kevin Bacon with the counts.
    - It shows a chain, and a red can't-be-linked line.
    - It moves to the Center in the field before showing a chain, and does not reload an unchanged Center.
    - A failed load clears the counts, and a failed chain says "search failed".
    - It ignores a late, older answer.
    - It does nothing with no Actor picked.
- **Real data check:**
  - Kevin Bacon's Layers are 1, 320, 13,060, 51,640, 39,764, 8,067, 786, 140 (the whole 113,778-Actor main Group, at most 7 Links away). 5,680 Actors can't be linked.
  - A new Center takes ~37 ms, a cached one ~0.02 ms, and a chain ~0.25 ms (Kevin Bacon → Leonardo DiCaprio = 2, via Brad Pitt).
  - The summary payload is 141 bytes. Startup is ~16 s (was ~14 s).
- **Decision recorded: D18.** It covers one full BFS per Center, the BFS parent chain, the default Center by exact name, the recent cache, the answer kept separate from the payload, the three endpoints, the list search reusing the autocomplete's rule, the shared `Chain` type, the tab's single `[enter]`, and the measurements.
- **Code review (`/code-review`, two parallel reviewers):**
  - **Standards:**
    - Fixed: `button` and `chainText` moved out of `pathPanel.ts` into their own modules (tab 1's panel was becoming a helper module); one `IndexChain` type instead of three spelled-out shapes; the one-line `chainToCenter` wrapper in `sixDegrees.ts` inlined into operations; the schema constant renamed to `centerSchema`; `FindChain` renamed to `FindChainToCenter`; "Can't be linked" added to `CONTEXT.md`.
    - Left as is: the `unlinked` endpoint and `sixDegrees()` (both required by the ticket's criteria); "ring" used for the visual, as in `design.md`.
  - **Spec:**
    - Every criterion met. Fixed: a chain could start from a Center the field no longer showed, so `[set center]` and `[show chain]` became one `[enter]` that loads the field's Center first; a failed Center load now clears the old counts; late, older answers are ignored (checked: removing the guard fails the new test); the default Center needs an exact name match, not a word-prefix match.
    - Left as is: no UI for the can't-be-linked list yet (the ticket asks only for the count); ring samples wait for the rings ticket (D18).
- **Verified:** `npm run typecheck` clean; `npm test` 92 tests, all pass; `npm run build` OK.
- **Committed** to `main`.
