# Decisions

Algorithmic decisions for the 3 operations and the data filter, in chronological order. Each entry:

- **Date / Operation**
- **Decision**: the algorithm chosen
- **Alternatives considered**
- **Why**: a full explanation of the choice
- **Running time**: time and space

<!-- Entries below -->

## D1: Graph representation (all operations)

- **Date:** 2026-11-10
- **Decision:** Store the data as a **bipartite actor–movie graph**. There are two node kinds, Actors and Movies, and one edge per credit (Actor appears in Movie). A search moves Actor → Movie → Actor. Distance in Links = steps ÷ 2.
- **Alternatives considered:** An actor–actor graph where every pair of actors in a Movie gets an edge (clique expansion), with each edge storing the list of Movies it came from.
- **Why:**
  - **Fewer edges.** A Movie with *p* actors costs *p* edges in the bipartite graph but *p(p−1)/2* in the actor–actor graph. A 10-actor Movie is 10 edges versus 45. The server runs on Render's free tier with 512 MB of RAM, and iFUB (D3) runs dozens of BFS passes, so a smaller graph means less memory and faster searches.
  - **Each Movie is expanded once per search.** When BFS first reaches a Movie node, it marks the Movie visited and releases all of its actors at once. The actor–actor graph would re-check every pair inside that Movie.
  - **The chain of movies comes free.** A path alternates Actor, Movie, Actor, Movie, so the movie chain the UI shows is the path itself. No edge needs to store a list of movies.
  - **One graph serves every tab.** Ratings live on Movie nodes, which is what tab 3's best-rated link needs.
  - **Cost:** the presenter has to explain that steps ÷ 2 = Distance.
- **Running time:** Memory O(A + M + C), where A = Actors, M = Movies, C = credits. Building it from the data file takes O(A + M + C).

## D2: Distance is unweighted (operation 1)

- **Date:** 2026-11-10
- **Decision:** Every Link counts as 1, whatever its Movie. Shortest paths are found with BFS.
- **Alternatives considered:** Weighting Links (for example, by rating) and using Dijkstra's algorithm.
- **Why:**
  - "Shortest path" in the assignment means the fewest actor-to-actor steps, the same meaning as Six Degrees of Bacon.
  - Ratings matter only in tab 3's best-rated option, not here.
  - With equal weights, BFS gives exact shortest distances in linear time. Dijkstra's would add an O(log V) factor and change nothing in the answer.
- **Running time:** One BFS on the bipartite graph takes O(A + M + C) time and O(A + M) space.

## D3: Largest finite shortest path uses iFUB with a 4-sweep start (operation 1)

- **Date:** 2026-11-10
- **Decision:** Find the **largest finite shortest path** (the largest diameter across all Groups) with **iFUB** (iterative Fringe Upper Bound; Crescenzi, Grossi, Habib, Lanzi, Marino, 2013), run separately on **every Group**. The start point is chosen with the **4-sweep**.
- **How it works:**
  1. **Find the Groups.** One pass of BFS/union-find labels every actor with its Group.
  2. **4-sweep (choose the center u).**
     - Start at the actor with the most links in the Group (ties go to the lowest id).
     - Run BFS and take the farthest actor, a₁. Run BFS from a₁ and take the farthest actor, b₁. Let r₂ be the actor halfway along the a₁→b₁ path.
     - Repeat from r₂ to get a₂, b₂, and the center u, the actor halfway along a₂→b₂.
     - Every distance seen during these 4 searches is a valid **lower bound**. The largest becomes the starting `lb`.
  3. **Sort into layers from u.** Run BFS from u. Lᵢ is the set of actors at Distance i from u, and e is the deepest layer.
  4. **Work from the outside in.** For i = e, e−1, …, run BFS from every actor in Lᵢ and raise `lb` to the largest distance found.
     - After finishing layer i, **stop if lb > 2(i−1)**.
     - Why the stop is safe: any two actors still unchecked are both within i−1 of u. By the triangle inequality their distance is at most 2(i−1), so neither can beat `lb`.
  5. The answer is the largest `lb` across all Groups. **Every Group is checked**, because a small Group can have a larger diameter than the main one.
- **Alternatives considered:**
  - **Naive all-sources BFS.** Run BFS from every actor and take the overall maximum, at O(A·(A+M+C)) time. With tens of thousands of actors that is about 10⁹–10¹⁰ steps, minutes to hours, and too slow to run when the server starts. It is kept as the baseline when presenting.
  - **Double-sweep alone.** Two BFS runs give a lower bound that is often tight, but it is **not guaranteed exact**. Rejected because the tests check exact answers.
  - **Using the most-linked actor directly as the center.** Simpler, but it usually leaves the farthest layer deeper or larger, so iFUB needs more BFS runs before it can stop. The 4-sweep costs only 4 extra BFS runs and also supplies a good starting `lb`.
- **Why iFUB:**
  - It is **exact**: it returns the same number as the naive method.
  - On real-world social/collaboration graphs, which have small diameters and a dense core, it stops after a few dozen BFS runs instead of A runs.
  - Its worst case is the same as the naive method, so nothing is lost.
  - It makes a good presentation story: the naive baseline, then one inequality that lets us skip almost all of the work.
- **Running time:** O(k·(A + M + C)), where k is the number of BFS runs (4 for the sweep + 1 from u + one per actor checked). Worst case k = A, giving O(A·(A + M + C)). In practice k is a few dozen. Space is O(A + M).

## D4: Two-actor shortest path uses bidirectional BFS (operation 1)

- **Date:** 2026-11-10
- **Decision:** Search between two chosen actors s and t with **bidirectional BFS**. Each round, the side whose current frontier has fewer actors expands **one full layer**. The search stops once that layer finds a meeting point, and the shortest meeting is kept.
- **Alternatives considered:** Plain BFS from s that stops when it reaches t.
- **Why:**
  - **Much less work.** Plain BFS explores a ball of radius d around s. Bidirectional BFS explores two balls of radius d/2, which on a graph that branches heavily is roughly the square root as many nodes.
  - **The animation payload stays small.** Results must include the links explored and rejected (brief: Application). Plain BFS can explore most of the database, which is too much to send or animate in 5–15 seconds. Bidirectional BFS keeps it to a few thousand links.
  - **It reads well on a projector.** Two searches grow toward each other and meet.
  - **A correctness detail.** Whenever a node is discovered, it is checked against the other side's visited set. The layer is always finished, and the shortest meeting found in it is kept. With full-layer expansion and checks at discovery, the first meeting is already a shortest one, so finishing the layer is a cheap safety rule. The known pitfall is stopping at the first meeting when the two sides expand node by node and check when a node is removed from the queue. That version can return a path one Link too long. *(Corrected 2026-11-10: the first version of this entry said the first meeting is always unsafe; that is only true for the node-by-node variant.)*
  - **No path.** If either search runs out of frontier without meeting the other, s and t are in different Groups. That produces the fully red "not possible" result.
- **Running time:** Worst case O(A + M + C). In practice it explores far less than plain BFS. Space is O(A + M).

## D5: Ties, when it runs, and the animation (operation 1)

- **Date:** 2026-11-10
- **Decisions:**
  - **The distance is the answer.** The pair of actors and the chain of movies are one example that proves it. Tests check the distance against the paper answer and check that the chain is valid (real Links, the right length, the right endpoints). They do not require a specific pair. Ties go to the lowest actor id so replays are identical. The tiny dataset is built with exactly one farthest pair so it can be explained on paper.
  - **It runs once, when the server starts**, and the result is kept in memory.
    - Alternatives were computing on the first request (the first user waits) and precomputing in the offline data script (production would never run the code the tests check).
    - Startup keeps one code path for both tests and production.
    - The extra startup time is hidden, because the site is opened a few minutes before presenting anyway.
    - If startup turns out too slow, the result can move into the data file without changing the module's interface.
  - **The animation replays bidirectional BFS (D4) between the two endpoints iFUB found.**
    - The alternative was animating iFUB itself. It means dozens of full BFS passes, with huge payloads and a second visual style.
    - The brief requires both searches on tab 1 to "look the same."
    - iFUB is explained by the presenter.
- **Running time:** Startup adds the iFUB cost (D3). Each request for the database-wide answer adds one bidirectional BFS (D4) to build the animation.

## D6: What a Cycle is, and the checks run before searching (operation 2)

- **Date:** 2026-11-10
- **Decision (definition):**
  - A **Cycle** visits all k **Chosen Actors**. It may pass through other Actors and never repeats an Actor.
  - A Movie may supply several of its Links. For example, Ann, Bob and Cat in *Heat* give a valid 3-Cycle that uses *Heat* three times.
  - Length = number of Links = number of Actors on the Cycle.
  - On the actor–movie graph (D1), the search tracks "visited" for **Actors only**. Movie nodes can be passed through again and again.
- **Decision (checks, in order):**
  1. **Different Groups.** Fully red: "these actors share no chain of movies." O(1), using the Group labels computed at startup.
  2. **No shared biconnected block.** A simple cycle always lies entirely inside one biconnected block (a part of the graph with no single actor whose removal disconnects it). If no block contains all k Chosen Actors, the result is fully red and names the **cut actor** every route has to pass through. An actor with only one co-star is the simplest case.
     - Blocks are computed for the **actor graph**: Tarjan's blocks of the actor–movie graph, merged wherever two blocks meet only at a Movie node. A Movie can be reused, so it is never a real cut point.
     - This runs once at startup. Each request then only looks up the k actors' blocks.
  3. **Otherwise, run IDA* (D7) inside that block only.**
  4. **The search runs out.** If the budget L goes past the number of actors in the block, no Cycle exists. Fully red: "no cycle through all of them exists without repeating an actor." This can happen even when step 2 passes: sharing a block guarantees a Cycle through any 2 actors, but not through 3 or more (example: the complete bipartite graph K₂,₃ with the 3 actors on the larger side).
- **Alternatives considered:** Skipping the checks and letting the search discover every "no" by itself. Rejected because that is slow (it explores the whole Group) and the reason it gives is not human-readable.
- **Why:**
  - Steps 1–2 answer most "not possible" cases instantly and with a specific reason, which the brief requires.
  - Step 3 shrinks the expensive search to one block.
  - Step 4 guarantees the search always ends, so "no" is exact and never a hang.
- **Running time:** Group labels and Tarjan's blocks take O(A + M + C) once at startup. Per request, checks 1–2 take about O(k) lookups.

## D7: Shortest Cycle uses IDA* (iterative deepening with a lower bound) (operation 2)

- **Date:** 2026-11-10
- **Decision:**
  1. Run BFS from each Chosen Actor (k runs, inside the block) to get exact distances d(·, cᵢ).
  2. **Lower bound for finishing from an actor v:** go from v to the next unvisited Chosen Actor, through all remaining Chosen Actors in the best order, and back to Chosen Actor #1, using BFS distances. Computed by brute force over orders (at most 5! = 120), or precomputed over subsets with the Held–Karp bitmask method.
  3. Start the budget L at the lower bound for the whole Cycle (the shortest tour of the k actors using BFS distances).
  4. Run a depth-first search (DFS) from Chosen Actor #1 over unused Actors, trying neighbors in order of lowest id. At each actor v, **prune** if length so far + lower bound from v > L. A Cycle is found when the DFS returns to #1 having visited all k.
  5. If a pass finds nothing, set L ← L + 1 and repeat. If L goes past the block size, the answer is "not possible" (D6 step 4).
- **Alternatives considered:**
  - **Brute force over all simple cycles.** Exponential with no pruning, hopeless on tens of thousands of actors.
  - **Fix the order, then join the actors with paths.** Try each cyclic order ((k−1)!/2 ≤ 60), then find paths between consecutive actors that share no actor. But finding the shortest set of non-overlapping paths is itself NP-hard, and separate BFS paths can overlap.
  - **Integer linear programming (ILP) solver.** Exact, but a heavy dependency, a black box that is hard to explain, and it gives no list of tried-and-rejected links to animate.
- **Why:**
  - **Exact.** The lower bound never overestimates, because a real path that can't repeat actors is at least as long as the BFS distance. So pruning never discards a Cycle of length ≤ L. Every budget below L found nothing, so the first Cycle found at budget L is the shortest.
  - **Reuses the building blocks:** the actor–movie graph (D1) and BFS (D2).
  - **Course material:** DFS, backtracking, admissible lower bounds, iterative deepening.
  - **The animation comes free.** Pruned branches are the brief's "explored and rejected" links.
  - **Allowed:** the problem is NP-hard (it includes Hamiltonian cycle), and the brief allows non-polynomial time.
- **Running time:** k·O(A + M + C) for the BFS runs, plus worst-case exponential search, roughly O(b^L) per pass, where b is how many neighbors each actor has, with at most (block size) passes. Space O(A + M) plus a stack of depth L. Pruning and the block restriction make it practical when the Chosen Actors are reasonably close together.

## D8: Cycle animation, ties and tests (operation 2)

- **Date:** 2026-11-10
- **Decisions:**
  - **Animation payload:** the Cycle plus up to **~300** rejected branches from the **final pass** (budget L = the answer's length), in the order they were tried, with a flag (and a count) if the list was cut short. The cap is a constant in the module.
    - For "not possible": checks 1–2 send the reason plus the links that make it true. Check 4 sends the capped rejections from the last pass.
    - Alternatives were sending everything (megabytes of noise) and sending only the Cycle (breaks the "explored and rejected" rule).
  - **The answer is the length**, or "not possible" with its reason category. The Cycle is one example.
    - Tests check: the length matches the paper answer; all Chosen Actors are present; no repeated Actor; every Link is backed by a Movie both actors are in; the Cycle closes.
    - "Not possible" tests check the reason **category** (different Groups, cut actor, or exhausted), not the wording.
  - **Ties:** neighbors are tried in order of lowest id, so the same input always gives the same Cycle.
  - **Movie reuse is shown on every Link it supplies.**
  - **Tiny dataset:** includes a Cycle that reuses one Movie, k = 3, k = 6, Chosen Actors split across Groups, and a **cut-actor case**.

## D9: Long Cycle searches run in a separate worker (operation 2)

- **Date:** 2026-11-10
- **Decision:** Each Cycle request runs in a separate worker thread or process, as one HTTP request with **no time limit**. The UI shows `searching…`.
- **Alternatives considered:**
  - **A plain synchronous request.** A single-worker server would block autocomplete and the other tabs during a slow search.
  - **A background job with polling and live progress.** More moving parts: a job id, a polling endpoint, cleanup.
- **Why:** It keeps the brief's no-limit rule, keeps the site responsive, and costs almost nothing extra.
- **Keep in mind:** If Render's timeout for a single HTTP request is shorter than our worst case, or long searches turn out to be common, upgrade to the background-job option. The module's interface doesn't change. Check Render's request timeout before presenting.

## D10: Layers are BFS distance; best-rated changes only the chain (operation 3)

- **Date:** 2026-11-10
- **Decision:**
  - **Layers** are found by BFS from the **Center** on the actor–movie graph (D1). Layer i = every Actor at Distance i.
  - Actors the BFS never reaches (everyone outside the Center's Group) are the **"can't be linked"** set.
  - The Layers are **identical** in shortest-link and best-rated modes. Only the chain shown for a picked actor changes.
- **Alternatives considered:** Letting best-rated redefine the Layers, so that a longer but better-rated chain could move an actor outward.
- **Why:**
  - "Six degrees" means Distance, so the rings must mean the same thing in both modes.
  - The brief's test asks for "different **links**," not different layers.
  - One BFS serves both modes.
- **Running time:** O(A + M + C) time, O(A + M) space.

## D11: Best-rated chain uses dynamic programming on the shortest-path DAG (operation 3)

- **Date:** 2026-11-10
- **Decision:**
  - The best-rated chain to v is the **shortest** chain whose Movies have the **highest average rating**. Every candidate has the same length, so the highest average is the highest **sum**.
  - Computed with **dynamic programming (DP), Layer by Layer** over the shortest-path DAG (only links from Layer i−1 to Layer i):
    - best(Center) = 0
    - best(v) = max over each p in Layer i−1 and each Movie m shared by p and v of [best(p) + rating(m)]
  - The winning (p, m) is stored for each v so the chain can be rebuilt.
  - On the actor–movie graph this splits into two small steps: each Movie between Layers i−1 and i takes the best value among its actors in Layer i−1, then each actor in Layer i takes the best (movie value + rating).
  - Ties go to the lowest id (actor, then Movie).
  - **Shortest-link mode** shows the BFS-parent chain: neighbors tried in order of lowest id, and the lowest-id Movie when a Link comes from several. It is *a* shortest chain, with no rating preference.
- **Alternatives considered:**
  - **Best worst movie (bottleneck).** Maximize the lowest rating in the chain. Ties are very common, so it often doesn't single out one chain, and it's a less natural reading of "best-rated."
  - **Enumerating all shortest chains.** The number of chains grows exponentially.
- **Why DP works:**
  - **The graph has no cycles:** links only go outward, from Layer i−1 to Layer i.
  - **Optimal substructure:** the prefix of the best chain to v is the best chain to its predecessor p. Otherwise, swap in the better prefix and get a better chain to v.
  - **Overlapping subproblems:** best(p) is reused by every actor in the next Layer that links to p.
  - **Order:** BFS Layer order is a topological order, so best(p) is always ready before it's needed.
  - **Presenting:** this is the classic **longest path in a DAG**, which is linear time on a DAG even though longest path is NP-hard on general graphs.
- **Running time:** O(A + M + C), in the same pass as the BFS. Each credit is looked at once. A chain is rebuilt in O(d).

## D12: Six Degrees payload, caching, answer and tests (operation 3)

- **Date:** 2026-11-10
- **Decisions:**
  - **Payload:** the first response has the per-Layer counts, the actors needed to draw each ring (sampled when a ring has more actors than screen cells, as `design.md` describes), and the can't-be-linked count. Clicking an actor asks the server for **one chain** in the selected mode, an O(d) walk back to the Center. The can't-be-linked list is served on request, paged and searchable.
    - Alternatives were sending everything (several MB) and recomputing on every click (repeats the full search).
  - **Caching:** Kevin Bacon is computed **at startup**. Other Centers are computed on request and kept in a small **least-recently-used cache (~8 Centers)**, each a few MB.
    - Precomputing every actor is impossible in 512 MB. Keeping nothing would force a recompute on every click.
  - **Answer:** the exact **set of actors in each Layer** (plus counts), the exact **can't-be-linked set**, and for chains the **length** (= Layer index) plus, for best-rated, the **total or average rating**. The chain itself is one example.
  - **Tests** (tiny dataset): correct Layer sets; the can't-be-linked set; chains valid (real Links, each Movie shared by both actors, ends at the Center); an actor whose shortest and best-rated chains differ; an actor who can't be linked.
  - **Animation:** rings appear one Layer at a time with counts. Clicking an actor draws their chain back to the Center in green.
- **Running time:** O(A + M + C) per new Center, O(1) for a cached one, O(d) per chain lookup. Memory is about 8 × a few MB for the cache.

## D13: Graph storage, numbering and Group labels (all operations)

- **Date:** 2026-11-10
- **Decisions:**
  - **Numbering.** Actors and Movies are numbered by their row in `actors.csv` and `movies.csv`. "Lowest id" in every tie rule (D5, D8, D11) means **lowest row number**. The data script (ticket #2) writes rows in id order, so the two agree.
    - Alternative: sort ids as strings when loading. Rejected because IMDb ids have different lengths (`nm9999999` vs `nm10000000`), so string order is not id order, and file order costs nothing.
  - **Storage (D1 made concrete).** Two compressed sparse row (CSR) indexes in `Int32Array`s: Actor → Movies and Movie → Actors. Each is built with a **counting sort** of the credits, and every row is then sorted ascending, so a search that walks neighbors in order automatically tries the lowest id first.
    - Alternative: arrays of arrays (`number[][]`). Rejected: one JavaScript array per node costs far more memory than two flat typed arrays, and the 512 MB limit matters (ADR 0001).
  - **Group labels use union-find** (disjoint sets with union by size and path halving). For every Movie, each of its Actors is joined to the Movie's first Actor. Groups are then renumbered 0, 1, 2, … in order of their lowest Actor.
    - Alternative: BFS from every Actor not yet labelled. Also linear and also exact. Union-find was chosen because it needs no queue and no per-search state, and it keeps BFS (which ticket #3 writes once, for every operation) out of the setup code, so there is still exactly one BFS in the codebase.
- **Running time:**
  - Building the CSR: O(A + M + C) for the counting sort, plus sorting each row: O(C log d), where d is the largest number of Movies per Actor or Actors per Movie (small: principal cast is at most ~10).
  - Group labels: O(C · α(A)), where α is the inverse Ackermann function (≤ 4 in practice), so effectively linear. Plus O(A) to renumber.
  - Space: O(A + M + C) for the CSR, O(A) for union-find and the labels.

## D14: Actor autocomplete uses a sorted word-start index with binary search

- **Date:** 2026-11-10
- **Decision:**
  - Every Actor name is **normalized** (lowercase, accents removed, spaces collapsed) and stored once **per word start**: "kevin bacon" and "bacon". Hyphens also start a word ("jean-luc" → "luc").
  - All keys go into **one sorted array**. A query is normalized the same way, then a **binary search** finds the first key ≥ the query, and a scan forward collects every key that starts with it.
  - Matches are de-duplicated (an Actor can match through two words) and **ranked** by number of Movies (more first, so the famous Kevin Bacon beats a one-film namesake), then by name, then by row number. The top `limit` (default 10, at most 50) are returned.
  - Every result has id, name and birth year, so the front end shows same-name Actors apart: "Sam Lee (1970)", "Sam Lee (1988)".
- **Alternatives considered:**
  - **Linear scan** of every name on each keystroke: O(A · q). Simple, but it re-reads every name for every keystroke. Fast enough at our size, but the sorted index is barely more code and scales.
  - **Trie:** the same prefix lookup in O(q), but one object per character costs many times the memory of a sorted string array.
  - **Substring match anywhere** ("evin" → Kevin): finds more but mostly noise, and needs a scan or a suffix structure. People type the start of a first or last name.
  - **Ranking by votes or popularity of the Actor's Movies:** better in theory, but Movie count is free from the CSR and already puts well-known Actors first.
- **Running time:**
  - Build: O(W log W) string comparisons, where W ≈ 2–3 × A is the number of word starts. Space O(W).
  - Query: O(q log W) for the binary search, plus O(r · q) to scan the r matching keys, plus O(r log r) to rank them. For a 1-letter query r can be large (thousands), which is still a few milliseconds.

## D15: The data filter is a streaming hash join over the four IMDb files (data script)

- **Date:** 2026-11-10
- **Decision:**
  - The script reads the four IMDb files **one after another, each once, line by line** from the gzip stream. Each pass keeps a row only if its key was kept by an earlier pass, using a hash set or map:
    1. `title.ratings`: keep titles rated **≥ 6.1** from **≥ 1,100 votes** (map: title id → rating, votes).
    2. `title.basics`: keep a title if it is in that map **and** its type is `movie` (a feature film; `tvMovie`, `short`, `video`, `tvEpisode` and the rest are left out). These are the Movies.
    3. `title.principals`: keep a row if its title is a Movie **and** its category is `actor` or `actress` (directors, writers, `self` and other crew are left out). Each Movie's cast is a set, so an Actor listed twice in one Movie (two roles) gives one credit.
    4. `name.basics`: keep a person if they are in some kept cast. These are the Actors.
  - A credit whose Actor has **no row in `name.basics`**, or whose name there is missing (`\N`), is dropped, so every credit names a known Actor and the graph builder (which rejects unknown ids) always loads the output.
  - The filter order is fixed by the dependencies: ratings are the most selective cheap test, so they go first and shrink the set every later pass must look up.
  - **Output order:** Movies and Actors are sorted by the **number in their id** (`nm9999999` before `nm10000000`), and credits by Movie, then Actor. This is the "lowest id" order of D13. A plain string sort would get it wrong because IMDb ids have different lengths.
  - A missing year or birth year (`\N`) is written as an empty field, which the loader reads as "unknown" (`null`).
- **Alternatives considered:**
  - **Load every file into memory, then join.** `title.principals` alone has close to 100 million rows (~790 MB compressed); as JavaScript objects that is many GB, far past a laptop's memory. Streaming keeps only the kept rows.
  - **Import into a database (SQLite, DuckDB) and join with SQL.** Correct and fast, but adds a native dependency and a second language for one script, against ADR 0001 (TypeScript everywhere). The four joins are simple key lookups that a hash set already does in O(1).
  - **Python with pandas.** The usual tool for this, but again a second language and stack, and pandas also loads whole files into memory.
  - **Sort-merge join** (sort each file by key, then merge). Needs external sorting of the big files on disk; hash lookups are simpler because the kept side (tens of thousands of Movies) fits easily in memory.
- **Running time:** let R, B, P, N be the rows of the four files (P dominates, ~10⁸), and M, A, C the kept Movies, Actors and credits.
  - Time: O(R + B + P + N) for the four passes, each row one O(1) hash lookup; plus O(M log M + A log A + C log d) for sorting the output, where d is the largest cast (≤ ~10). The passes are bound by gunzip and disk speed.
  - Space: O(R' + M + A + C), where R' is the titles of any type that pass the rating filter (pass 1 cannot yet know the type), plus the kept rows and hash sets; each file is streamed, so only one line of it is in memory at a time.

## D16: One BFS, stepped one Link at a time, and how bidirectional BFS uses it (operation 1)

- **Date:** 2026-11-10
- **Decisions:**
  - **One BFS, stepped one Link at a time.** `src/server/bfs.ts` holds the only BFS: `startSearch` makes the per-search state (distance, parent Actor, parent Movie, Movies already expanded), `expandFrontier` moves the whole frontier out by exactly one Link (Actor → Movie → Actor) and returns the newly reached Actors, and `chainTo` walks the parents back. Bidirectional BFS (D4) runs two of these and picks which one to step; the later full searches (iFUB, Six Degrees, where each frontier is one Layer) loop `expandFrontier` until the frontier is empty.
    - Alternative: a callback-style `bfs(source, onVisit)` that runs to the end. Rejected: bidirectional BFS has to stop between Layers and switch sides, which a run-to-the-end function cannot do without a second BFS.
  - **A step is a whole Link, not half of one.** Each call goes Actor → Movie → Actor, so the distance it stores is already in Links. This is the "steps ÷ 2" of D1 done inside the step, not at the end. Meetings are checked on Actors only: if one side has expanded a Movie, it has already reached every Actor in it, so the two sides cannot share a Movie without also sharing an Actor in the same or the next round.
  - **Each side marks its own Movies.** A Movie is expanded at most once per side, so each search touches every credit at most once (D1).
  - **Which side steps:** the one whose frontier has fewer Actors; on a tie, side a (the first Actor picked). Stop when a step reaches an Actor the other side has reached, or when either frontier is empty. An empty frontier means the whole Group of that Actor has been seen without meeting the other, so they are in different Groups: "no path". This stops after exploring the *smaller* Group, not both.
  - **Ties go to the lowest index (= lowest id, D13).** Frontiers are kept sorted, and each Actor's Movies and each Movie's Actors are already sorted (D13), so every Actor's parent is the lowest-index frontier Actor that links to it, through their lowest-index shared Movie. Among meetings with the same total, the lowest-index meeting Actor wins. The same pair always gives the same chain.
  - **Explored links = the search trees.** The result lists, in order, every Link that reached a new Actor (from, Movie, to, and which side). The chain's Links are among them; the rest are the "explored and rejected" links the animation turns red. Links to Actors already reached are not listed: they add nothing to the picture and would multiply the payload by the average cast size.
    - Alternative: list every Link looked at, including repeats. Rejected for size: on the real data a query explores a few hundred tree Links; every Link looked at would be several times more.
  - **Same Actor twice:** Distance 0, chain of one Actor, no search.
  - **Errors:** an id not in the data throws `UnknownActorError`; the API's error handler (not the operations module, which knows nothing of HTTP) answers it with 404. A missing id is a 400 from the request schema.
- **Measured on the real data** (29,705 Movies, 119,458 Actors): five well-known Actors, all ten pairs, take 2–7 ms each and explore 250–680 Links.
- **Running time:** `expandFrontier` is O(size of the frontier's Actors + their credits + the credits of the Movies newly expanded), plus O(n log n) to sort the n Actors it returns. Over a whole search every credit is looked at at most twice per side, and each Actor is sorted into one frontier once, so the worst case is O(A log A + M + C) time (the log only from sorting frontiers; effectively the O(A + M + C) of D4) and O(A + M) space per side, as in D4. Rebuilding the chain is O(d).
