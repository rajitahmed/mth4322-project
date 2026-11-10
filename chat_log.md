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
