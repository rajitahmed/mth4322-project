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
  - **The distance is the answer.** The pair of actors and the chain of movies are one example that proves it. Tests check the distance against the paper answer and check that the chain is valid (real Links, the right length, the right endpoints). They do not require a specific pair. Ties go to the lowest actor id so replays are identical. (D17 shows how iFUB returns exactly the lowest-id pair.) The tiny dataset is built with exactly one farthest pair so it can be explained on paper.
  - **It runs once, when the server starts**, and the result is kept in memory.
    - Alternatives were computing on the first request (the first user waits) and precomputing in the offline data script (production would never run the code the tests check).
    - Startup keeps one code path for both tests and production.
    - The extra startup time is hidden, because the site is opened a few minutes before presenting anyway.
    - If startup turns out too slow, the result can move into the data file without changing the module's interface.
  - **The animation replays bidirectional BFS (D4) between the two endpoints iFUB found.**
    - The alternative was animating iFUB itself. It means dozens of full BFS passes, with huge payloads and a second visual style.
    - The brief requires both searches on tab 1 to "look the same."
    - iFUB is explained by the presenter.
- **Running time:** Startup adds the iFUB cost (D3). Each request for the database-wide answer adds one bidirectional BFS (D4) to build the animation. (D17: that BFS now also runs once at startup, and requests are served from memory.)

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

## D17: iFUB in code: Groups by size with a size bound, the lowest-id pair, Links counted as distinct co-stars, and the chain cached (operation 1)

- **Date:** 2026-11-10
- **Decisions:**
  - **Groups are searched biggest first, and a Group of n Actors is skipped once n − 1 < the best Distance so far.** No two Actors in a Group of n can be more than n − 1 apart (a shortest chain never repeats an Actor). Groups are sorted by size, so the first Group that fails this test ends the loop: every later one is no bigger. This is still "iFUB on every Group" (D3). A skipped Group provably cannot reach the answer, so the answer stays exact, and a smaller Group whose farthest pair is farther apart still wins (tested). The test is `<`, not `≤`, so a Group that could *tie* is still searched, because a tie might hold a lower-id pair (next point).
    - Alternative: run iFUB on every Group, as D3 literally says. Also exact, but the real data has **846 Groups**, most with 2–10 Actors, and each search allocates arrays the size of the whole graph. The bound skips about 810 of them for free.
    - Alternative: a tighter bound per Group (for example, from its Movie count). Rejected (KISS): the size bound already skips nearly every small Group.
  - **Ties go to the lowest-id pair, exactly (D5, issue #4).** A pair is written lower index first, and pairs compare by their first Actor, then their second. Every full search from x offers one candidate: x and its farthest Actor (the lowest index in its last Layer). The answer is the largest Distance and, on equal Distances, the lowest candidate, across all Groups.
    - **Why this gives the lowest-id pair overall without extra searches.** When iFUB stops after layer i, lb > 2(i−1), and every pair with both Actors in layers 0 … i−1 is at most 2(i−1) apart. So every pair at the final Distance has at least one Actor x that iFUB searched from. x's candidate is the lowest pair containing x at that Distance, so it is no higher than that pair.
    - Alternative: "the first pair found" (the first draft). Deterministic, but not the lowest-id pair, and the code review flagged it as not meeting D5. Another alternative was a separate search from every Actor at the final Distance to list all tied pairs. Rejected: it adds searches for no gain, because the argument above already covers every tied pair.
    - Checked against a BFS from every Actor (lowest-id pair included) on 200 seeded random graphs, plus a dataset where a bigger, higher-id Group ties a smaller, lower-id one.
  - **"The Actor with the most Links" (the 4-sweep's r₁) counts distinct co-stars**, matching CONTEXT.md's Link (two Actors who share at least one Movie). Two Movies with the same co-star count as one Link. Ties go to the lowest index (= lowest id, D13).
    - Alternative: count Movies (the CSR row length, free to read). Rejected: an Actor in many two-person Movies would look more central than one in a few big ensemble casts, which is the opposite of what the 4-sweep wants.
  - **The midpoint** of a chain of d Links is its Actor number ⌊d/2⌋ (counting the start as 0). Frontiers are sorted (D16), so every choice in the 4-sweep is deterministic.
  - **One BFS still.** The full search is `searchLayers` in `bfs.ts`: it loops `expandFrontier` (D16) to the end and returns each Distance's Actors (Layers, when the start is the Center). iFUB, the tests' baseline, and later Six Degrees use it.
  - **The chain is cached too.** D5 said each request re-runs bidirectional BFS between the two endpoints. The result is deterministic, so the operations module runs it once, at startup, right after iFUB. The endpoint returns the cached chain and explored Links. Same answer, less work per request.
  - **Endpoint:** `GET /api/largest-path` takes no parameters. It returns the same shape as the two-actor path (`FoundPath`), so tab 1's result line and animation treat both searches the same way (the brief's "look the same"). The lower-id Actor is the first one in the chain. The tab has a `[largest path]` button before the optional two Actor fields, and the answer appears on the same result line.
  - **Tests:** the tiny dataset's paper answer (Distance 7, Pia Holt → Xia Ortiz). A star Group (largest Distance 2, more Actors, lower ids) beside a smaller chain Group (largest Distance 4), where the chain wins. The cross-Group tie described above. iFUB matches a BFS from every Actor (Distance and pair) on 200 seeded random graphs.
- **Measured on the real data** (29,705 Movies, 119,458 Actors, 846 Groups, the largest with 113,778 Actors):
  - **The answer:** **Distance 12**, Óscar Acúrcio (nm0010352) ↔ Abolfazl Ahankhah (nm0013842). The chain runs Portuguese cinema → Marcello Mastroianni → Greek cinema → Iranian cinema.
  - **The search:** the 4-sweep alone already reaches 12. Layers from u have sizes 1, 554, 20,900, 59,339, 28,381, 4,180, 346, 77 (e = 7). iFUB searches from every Actor in layers 7 and 6 (423 searches) and stops at i = 6, because 12 > 2·5.
  - **The cost:** about 430 searches of ~28 ms each, **~14 s at startup** with the chain. The method that searches from every Actor would need ~113,778 searches (about an hour).
  - **The payload:** the chain's bidirectional BFS explores 4,681 Links, so the response is ~325 KB.
- **Running time:** as D3: O(k·(A + M + C)) time with k ≈ 430 on the real data, and O(A + M) space per search. Counting Links for r₁ is O(Σ cast sizes over the Group's credits) per Group. Grouping and sorting Groups is O(A + G log G) for G Groups. The size bound and the tie rule add O(1) per search.

## D18: Six Degrees in code: one full BFS per Center, the default Center, a small recent cache, and three endpoints (operation 3)

- **Date:** 2026-11-10
- **Decisions:**
  - **One full BFS per Center, the same BFS as everything else.** `src/server/sixDegrees.ts` runs `searchLayers` (D16, D17) from the Center. Its Layers are the Six Degrees Layers (D10): Layer i = the Actors at Distance i, lowest index first. Actors left at distance −1 are the **can't-be-linked** set, collected once per Center in index order. The search's parent arrays are kept, so a chain is `chainTo` (the BFS parents) walked back to the Center, O(d).
    - Alternative: a separate union-find lookup for "can't be linked" (the Group labels already exist, D13). Rejected: the BFS has already marked exactly those Actors, so reading its distance array costs nothing extra and needs no second rule.
  - **The shortest-link chain is the BFS parent chain** (`algorithms.md` §6.2). `expandFrontier` walks frontier Actors and their Movies in index order, so each Actor's parent is the lowest-index Actor in the previous Layer that links to it, through their lowest-index shared Movie. On the tiny data Xia Ortiz's chain is Kevin → *Low Tide* → Sid → *Low Tide 2* → Xia, the paper answer. The best-rated chain (D11) is a later ticket and does not change the Layers.
  - **The default Center is found by name.** It is the Actor named exactly "Kevin Bacon" who ranks first in the autocomplete. The autocomplete puts Actors with more Movies first, so this is the real Kevin Bacon (nm0000102) even when another Actor shares the name. The exact-name check stops a longer name such as "Kevin Bacon Jr." from winning a word-prefix match (code review). A dataset with no Kevin Bacon falls back to its first Actor, so small test datasets still work.
    - Alternative: hard-code the IMDb id `nm0000102`. Rejected: the tiny dataset uses `nm01`, and the brief wants one loader and one code path for both datasets.
  - **Caching (D12):** the default Center is computed **once, at startup**, beside the largest path, and kept forever. Other Centers go through `recentCache`, which keeps the **8 most recently used** and drops the least recently used. It uses a `Map`, which remembers insertion order, so re-inserting a key on each use is the whole LRU.
    - Alternative: a cache library, or a linked-list LRU. Rejected (KISS, YAGNI): with 8 entries, deleting and re-inserting a `Map` key is O(1) and a dozen lines.
  - **The answer and the payload are separate methods (D12).** `sixDegrees(center)` returns the full answer (every Layer's Actors and the can't-be-linked Actors). The tests check it against the paper answer. The API serves only:
    - `GET /api/six-degrees?center=` returns the Center, the Actor count per Layer (Layer 0 is the Center), and the can't-be-linked count. On the real data that is **141 bytes**, against several MB for every Layer's Actors.
    - `GET /api/six-degrees/chain?center=&actor=` returns one chain, `{ found: false }` for an Actor who can't be linked, 400 with no Actor, and 404 for an unknown id.
    - `GET /api/six-degrees/unlinked?center=&q=&offset=&limit=` returns one page (50 by default, at most 200) of the can't-be-linked Actors in id order, filtered by name, plus the `total` of all matches.
    - `center` is optional everywhere: the default Center when it is missing. Ring samples for the animation (D12, `design.md`) come with the rings ticket; this ticket shows a plain list (YAGNI).
  - **Searching the can't-be-linked list uses the autocomplete's rule** (a word of the name starts with the query, ignoring case and accents). `actorSearch.ts` now exports `nameMatcher`, so there is still one matching rule (D14). The list is short (5,680 Actors on the real data), so a linear filter is enough.
    - Alternative: run the autocomplete index and intersect with the set. Rejected: a one-letter query matches ~100,000 Actors in the whole index just to keep a few thousand.
  - **Shared `Chain` type.** `FoundPath` (tab 1) now extends `Chain` (Distance, Actors, Movies). The Six Degrees chain is `Chain` plus `found`. On the server, `IndexChain` (in `bfs.ts`) is the index form. One mapping from indices to ids (`chainOf`) and one way to write a chain (`src/web/chainText.ts`) serve both tabs.
  - **"Can't be linked" is now a CONTEXT.md term.
  - **Tab 3 (plain view):** the panel has a center field (Kevin Bacon to start), an actor field and one `[enter]`. It lists `layer i: count` and `can't be linked: n`. `[enter]` first loads the Center in the field if it changed, then puts the picked Actor's chain on the result line: `layer 2: Kevin Bacon — Low Tide — Sid Moss — Low Tide 2 — Xia Ortiz`, or, in red (= not possible), `can't be linked: … shares no chain of movies with …`.
    - Alternative (the first draft): separate `[set center]` and `[show chain]` buttons. The code review found that a chain could start from a Center the field no longer showed. One button that always uses the Center on screen removes that case.
    - Only the newest request may change the screen. An older answer that arrives late is ignored, the same rule as the autocomplete. A failed Center load clears the old counts and does not ask for a chain.
    - The can't-be-linked **list** is served by the API but not shown in this tab yet. The ticket's UI criterion asks only for the count.
- **Measured on the real data** (29,705 Movies, 119,458 Actors):
  - Kevin Bacon's Layers are 1, 320, 13,060, 51,640, 39,764, 8,067, 786, 140. That is the whole 113,778-Actor main Group, so his farthest Actors are 7 Links away. **5,680** Actors can't be linked.
  - A new Center takes **~37 ms**, a cached one ~0.02 ms, and a chain ~0.25 ms (Kevin Bacon → Leonardo DiCaprio: 2, via Brad Pitt). One page of the can't-be-linked list takes ~9 ms.
  - Startup goes from ~14 s to ~16 s: iFUB plus Kevin Bacon's search.
- **Running time:** O(A log A + M + C) per new Center (one BFS, D16) and O(A) to collect the can't-be-linked set. O(1) for a cached Center, O(d) per chain, O(U · name length) per page of the can't-be-linked list (U = its size). Memory is O(A + M) per Center: about 2 MB on the real data, so the default Center plus 8 recent ones stay under ~20 MB.

## D19: Best-rated chain in code: Layer-by-Layer DP after the BFS, ratings in tenths, one chain walker, and a mode toggle (operation 3)

- **Date:** 2026-11-10
- **Decisions:**
  - **D11's DP, as written in `src/server/sixDegrees.ts` (`bestRatedChoices`).** For each Center, right after its BFS (D18), the Layers are walked in order. Each Layer i takes two steps:
    1. **Movies first.** For every Actor p in Layer i−1, for every Movie m of p: movieBest(m) = the highest best(p) seen, and movieFrom(m) = that p. A Movie is reset the first time Layer i touches it (`movieLayer[m] = i`), so the same three arrays serve every Layer.
    2. **Then Actors.** For every Actor v in Layer i, for every Movie m of v that Layer i−1 touched: value = movieBest(m) + rating(m). The highest value is best(v), and (movieFrom(m), m) is v's choice.
    - A Movie touched by Layer i−1 contains only Actors at Distance i−1 or i (two Actors in one Movie are at most 1 Link apart), so the Actors in step 2 that see it are exactly those it links forward. Links inside a Layer or pointing back are never used, as the shortest-path DAG requires.
  - **"Same pass as the BFS" means the same per-Center computation, not inside `expandFrontier`.** `layersAround` runs the BFS, then the DP over its Layers, and caches both together (D12, D18). The one BFS (D16) stays unchanged and single-purpose, and every operation still shares it.
    - Alternative: fold the DP into `expandFrontier`. Rejected: it would give the one BFS a rating concern that tab 1 and the cycle search do not want, and the cost is the same O(A + M + C) either way.
  - **Ratings are added as whole tenths** (`ratingTenths`: 7.7 → 77). IMDb ratings have one decimal, so sums are exact integers, and ties are real ties. With floating point, 6.2 + 6.3 and 6.1 + 6.4 might compare unequal, and the tie rule would depend on rounding. Totals and averages are divided back to ratings only when returned.
  - **Ties go to the lowest Actor, then the lowest Movie (D11).** Step 1 walks Layer i−1 lowest index first and only replaces on a strictly higher value, so each Movie keeps its lowest p. Step 2 walks v's Movies lowest index first; on an equal value it switches only to a lower p. A test builds a tie where the lowest Movie belongs to the higher Actor, and checks that the lower Actor wins.
  - **One chain walker.** The best-rated choices are stored as the same two arrays as the BFS parents (`parentActor`, `parentMovie`; the `Parents` type in `bfs.ts`). `chainTo` now takes any `Parents`, so both modes rebuild their chain with the same O(d) walk (DRY).
  - **Every chain reports its ratings.** `chainToCenter(center, actor, mode)` returns the chain plus `totalRating` and `averageRating` (D12's answer: length = Layer index, plus total and average). The average is `null` for the Center itself (no Movies). Both modes report them, so the screen can show how much better the best-rated chain is.
  - **API:** `GET /api/six-degrees/chain` takes `mode=shortest|best-rated` (default `shortest`); any other value is a 400.
  - **Tab 3 toggle:** `[shortest link] [best-rated link]` under the fields, the chosen one in `--accent` (`aria-pressed`). Switching mode asks the server again for the chain already on the result line (an O(d) lookup in the cached Center) and never asks for the Layers again. With no chain on screen, it only sets the mode for the next `[enter]`. The result line now ends with `(rating 17.3, average 8.65)`; the average is shown to at most 2 decimals.
    - Alternative: fetch both chains on every `[enter]` and switch locally. Rejected (YAGNI): it doubles every request for a toggle most clicks never use, and the lookup is ~0.1 ms.
  - **One home for each shared fact (code review).** The mode list is one constant, `CHAIN_MODES` in `src/shared/types.ts`, read by the API's validation and the toggle (`ChainMode` is derived from it). Rating arithmetic lives only in `sixDegrees.ts`: `ratingTenths` (private) and `chainRatings(graph, chain)`, which `chainToCenter` calls for both modes. The choices are named `bestRatedParents`, and `chainTo`'s argument `parents`, since it is no longer always a search.
  - **Ratings in both modes** (the spec review noted the ticket asks for them only on the best-rated chain). Kept: D12's answer is "length plus the total or average rating", it costs one O(d) sum, and showing both lets the user see what best-rated gains.
- **Tests (tiny dataset, paper answers in `data/tiny/ANSWERS.md`):** Xia Ortiz's best-rated chain goes through Sue Nash (High Noon Redux, High Noon Redux 2: 17.3, average 8.65) and differs from the shortest one (Sid Moss, 12.5) in the same Layer; Dev Ennis's two chains are the same (27.4); every Actor's best-rated chain is valid and as long as their Layer; the Center gets rating 0 and no average; an Actor who can't be linked gets no chain; the tie rule; the API's `mode` and its 400; the panel toggle switches the chain without reloading the Layers.
- **Measured on the real data:** a new Center goes from ~43 ms (BFS only) to ~72 ms (BFS + DP). Kevin Bacon → Leonardo DiCaprio: shortest via Brad Pitt (Sleepers, Once Upon a Time in… Hollywood: 15.1, average 7.55); best-rated via Jack Nicholson (A Few Good Men, The Departed: 16.3, average 8.15). In a sample of 2,000 Layer-3 Actors, 1,459 have a better best-rated chain than their shortest-link one, and none has a worse one.
- **Running time:** O(A + M + C) per new Center for the DP: step 1 reads each credit of Layer i−1's Actors once and step 2 each credit of Layer i's Actors once. Space O(A + M): two more `Int32Array`s per Actor are kept per Center (about 1 MB on the real data), three per Movie are temporary. O(d) per chain in either mode, O(1) for a cached Center.

## D20: Cycle checks in code: iterative Tarjan, merge at Movies, a block–cut forest to name the cut actor (operation 2)

- **Date:** 2026-11-10
- **Decisions (D6 steps 1–2, as written in `src/server/blocks.ts` and `src/server/cycleChecks.ts`):**
  - **Tarjan's blocks of the actor–movie graph, as an iterative DFS.** Nodes are Actors 0…A−1 and Movies A…A+M−1. Each node keeps its discovery time, its low-link, its DFS parent and the next edge to try; an explicit call stack replaces recursion. When a child v finishes with low(v) ≥ disc(parent), the nodes discovered since v (still "open") plus the parent form one block.
    - Alternative: the recursive textbook version. Rejected: the real data's DFS goes tens of thousands of nodes deep and would overflow the JavaScript stack.
    - Alternative: the edge-stack version. Rejected: we only need which nodes are in which block, and a node stack is simpler.
  - **Merge at Movies with union-find.** Every block that holds a given Movie is unioned with that Movie's first block. Then only Actor memberships are kept, and merged blocks are renumbered 0, 1, 2, … This gives the blocks of the actor graph (D6): a Movie can be reused by a Cycle, so it is never a cut point. An Actor never ends up in the same merged block twice: two of its own blocks meet only at the Actor in the block–cut tree, so no chain of Movie merges joins them.
    - Alternative: build the actor graph (every pair of co-stars) and run Tarjan on it. Rejected: it multiplies the edges by the cast size, and D1 keeps the bipartite graph as the only graph.
  - **Stored per Actor as a CSR** (`actorBlocks`, the same `Csr` as D13). Only a cut actor has more than one block, so the whole thing is about A + (cut actors) numbers.
  - **Check 2 per request:** a block holds all k Chosen Actors if one of the first Actor's blocks is in every other Actor's list. The lists are tiny (1 for almost every Actor), so this is O(k) lookups.
  - **Naming the cut actor: a rooted block–cut forest.** One node per Actor, one per merged block, a tree edge between a block and each of its Actors. Each tree is rooted at its lowest Actor by BFS, storing parent and depth. For a pair (a, b) that shares no block, both climb to their meeting node; the first Actor strictly inside that path is the cut actor nearest to a, and every route from a to b passes through it. Different trees means different Groups (null).
    - Alternative: a BFS over the forest per request. Rejected: O(A) per request when the climb is O(path length).
    - Alternative: name any Actor whose removal splits the pair, found by trying each one. Rejected: O(A·(A+M+C)).
    - **Why its own short BFS, not the shared one in `bfs.ts` (code review).** The shared BFS walks the actor–movie graph and returns Distances and Link parents; rooting walks a different graph (Actors and blocks) and needs tree parents and depths over both kinds of node. Bending the shared BFS to take any graph would add a layer that only this one-time startup loop uses. "BFS written once" (CLAUDE.md) is kept for every search over Actors and Movies.
  - **Which pair is named.** Pairs are tried in the order the user entered the Chosen Actors, and the first pair with no shared block is named. Such a pair always exists when no block holds all k: each Actor's blocks form a star (a subtree) in the block–cut tree, and subtrees of a tree that meet pairwise all share one node (the Helly property). That node can't be an Actor (the Chosen Actors are distinct), so it would be a block holding all k. The code throws if this ever fails.
  - **Answer shape:** `CycleCheck` in `src/shared/types.ts`: `not-possible` with reason `different-groups`, `not-possible` with reason `cut-actor` (the cut actor and the pair it splits), or `shares-block`. The next ticket adds the search's own outcomes. Index-based results (`IndexCycleCheck`) carry the block id, which the search will need.
  - **API:** `GET /api/cycle?actors=…&actors=…` (repeated parameter). Fastify's schema enforces 3–6 ids (`MIN_CHOSEN_ACTORS`, `MAX_CHOSEN_ACTORS`, one constant each in `shared/types.ts`) and `uniqueItems`, so a duplicate is a 400; an unknown id is a 404.
  - **Tab 2:** 3 actor fields, `[add actor]` adds one up to 6 (then it is disabled), and `[enter]` asks only when every field has an Actor. **Duplicates are blocked at the source:** each field's suggestions leave out the Actors picked in the other fields. Not-possible results are fully red: "not possible: these actors share no chain of movies" or "not possible: every route from Pia Holt to Ada Hart passes through Dev Ennis".
    - Alternative: let the user pick a duplicate and reject it at `[enter]`. Rejected: an error after the fact is worse than never offering the choice.
- **Tests:**
  - On 150 seeded random graphs (casts of 1–4 Actors, so many one-co-star Actors and small Groups), "share a block" agrees for every pair with **Menger's theorem**, checked by brute force: linked, or no third Actor whose removal separates them. Removing the merge at Movies makes this test fail.
  - On the same graphs, every named cut actor really separates the pair, and none is named when the pair shares a block or is in different Groups.
  - A Movie with 3 Actors and no other links: they share a block (a Movie is never a cut point).
  - Tiny dataset (paper answers): Kevin, Ada, Sam Lee 1988 → different Groups. Pia, Dev, Ada → cut actor Dev Ennis, between Pia and Ada. Tom, Uma, Sam Lee 1970 (only through "Heat, Again"), the k = 6 ring, and Kevin, Sid, Xia all share a block.
- **Measured on the real data** (119,458 Actors): the blocks and the forest take **~185 ms** at startup. There are 1,727 merged blocks and 846 cut actors; the largest block holds 108,122 of the main Group's 113,778 Actors. A check takes 0.05–0.4 ms (Kevin Bacon, Tom Hanks, Meryl Streep share a block, and so do Bacon, Pitt, DiCaprio, Cruise, Roberts, Freeman).
- **Running time:** O(A + M + C) at startup (one DFS, near-linear union-find, one BFS over a forest of A + B nodes). Space O(A + M) temporary, O(A + B) kept. Per request: O(k) Group lookups, O(k · blocks per Actor) for the shared block, and O(k² · forest depth) at worst to name the cut actor.

## D21: Cycle search in code: IDA* over block co-stars, Held–Karp bound, the shared BFS, one worker thread per search (operation 2)

- **Date:** 2026-11-10
- **Decisions (D6 steps 3–4, D7, D8, D9, as written in `src/server/cycleSearch.ts`, `cycleWorker.ts`, `cycleWorkerEntry.ts`):**
  - **IDA* exactly as D7.**
    - It is a depth-first search from Chosen Actor #1 with a budget L.
    - A branch to co-star w is **rejected** when length so far + 1 + h(w, Chosen Actors still to visit) > L.
    - L starts at h(#1, all the others) and rises by 1 after each pass that finds nothing.
    - **The answer is `no-cycle` (D6 step 4) as soon as either of these holds:**
      - **A pass rejects nothing** (added after code review). The budget is the only thing a pass depends on, and if it cut no branch, that pass already tried every simple route from #1. A bigger L would repeat the same search and find nothing.
      - **L passes the block's Actor count.** D6's bound, kept as the guarantee that the loop ends.
    - Why the early stop matters: without it, a no-cycle search keeps re-running the same complete search until L reaches the block size, which is 108,122 on the real data. On K₂,₃₀₀ (300 Actors linked only to 2 hubs), the search took **46.6 s** without the stop and stops at L = 10 with it.
    - Only Actors are marked used, so one Movie can supply every Link of a Cycle.
    - **When a Cycle closes:** the DFS has visited every Chosen Actor and reaches a co-star that is #1. No length check is needed there. The prune already guaranteed length + d(v, #1) ≤ L, and every smaller budget was searched in full and found nothing, so the Cycle's length is exactly L.
    - Alternative: A* with a priority queue. Rejected in D7 because of memory; IDA* keeps only the current path.
  - **Co-stars are generated on the fly, inside the block only.**
    - For the current Actor, walk its Movies (lowest index first) and their casts, and keep the Actors in the block. Remember the first (lowest-index) Movie for each co-star, then sort by Actor index.
    - Lowest id first makes the result deterministic (D8). The lowest-index Movie is the one shown for each Link.
    - Alternative: build the actor–actor adjacency of the block once. Rejected: on the real data that is the clique expansion D1 refused (cast size squared per Movie), for a block of 108,122 Actors.
    - Alternative: cache each Actor's co-star list across passes. Rejected for now (YAGNI): the measured searches are already fast (below).
  - **"In the block" is one `Uint8Array` flag per Actor**, filled from D20's block CSR in O(A). The count of flags is the block size, the D6 step 4 limit.
  - **The lower bound h uses the one shared BFS** (`searchLayers` in `bfs.ts`) from each Chosen Actor, over the whole Group, not just the block.
    - The distances are the same either way. A shortest path is simple, and a simple path between two Actors of a block can't leave the block: it would have to leave and come back through the same cut actor.
    - So the shared BFS, unchanged, gives exactly D7's distances, and BFS is still written once.
  - **h by Held–Karp, precomputed per search.**
    - finish[R][j] = the shortest way from Chosen Actor j through the rest of R and back to #1, using BFS distances. It is stored for every subset R of the other Chosen Actors as a bitmask (at most 2⁵ × 6 entries) and built in increasing mask order.
    - Then h(v, R) = min over j in R of d(v, cⱼ) + finish[R][j], or d(v, #1) when R is empty. Each h takes at most 5 lookups.
    - Alternative: brute force over the orders of R at every node (at most 120 orders). Rejected: h is called for every branch, so the precomputation pays for itself at once.
    - **Admissible** (D7): every leg of a real finish is a real path, so it is at least as long as its BFS distance.
  - **The DFS is recursive.** Its depth is at most L, because each step costs a Link and h ≥ 1 away from #1. L is small for any search that finishes. Unlike Tarjan (D20), it never goes tens of thousands deep.
  - **Animation payload (D8).**
    - Each pass starts a fresh list. A rejected branch is kept as (from, Movie, to) while the list holds fewer than `MAX_REJECTED` = 300; after that it is only counted, in `moreRejected`.
    - The list returned is from the final pass: the one that found the Cycle, or the last pass at L = block size.
    - `moreRejected` > 0 is the "cut short" flag, so one number serves as both the flag and the count.
  - **One worker thread per search (D9).**
    - `operations.shortestCycle` runs the checks on the request thread (they are O(k)). Then it sends `{ links, actorBlocks, block, chosen }` to a new `worker_threads` Worker and awaits the answer. The worker exits once it has answered.
    - **Only the Links are sent:** the graph's two CSRs, not the Actor and Movie records. `graph.ts` and `bfs.ts` now accept a narrower `Links` type for this. The CSRs are copied (structured clone), a few MB for the real data.
    - **Loading TypeScript in the worker:**
      - The app runs under tsx, but a worker does not inherit tsx's import hooks, and in a test there is no loader at all. `--import tsx` alone failed to resolve the extensionless imports.
      - So the worker starts from a one-line bootstrap that calls tsx's `tsImport` on `cycleWorkerEntry.ts`.
      - Measured cost: about 0.25 s per search to start the worker.
    - Alternative: one long-lived worker that loads the graph itself. Rejected: a slow search would queue every other Cycle request behind it, and the worker would hold a second copy of the whole dataset.
    - Alternative: `SharedArrayBuffer` for the CSRs, so nothing is copied. Rejected for now: the copy is cheap, and shared buffers would change how the graph is built.
    - Alternative: run the search on the request thread, yielding every N branches. Rejected: it would tangle the algorithm with scheduling, and the k full BFS runs would still block.
  - **Answer shape:** `ShortestCycle` in `src/shared/types.ts`, replacing the earlier `CycleCheck`.
    - `found`: the length, the Actors, the Movies (the last Movie closes back to Actor #1), `rejected` and `moreRejected`.
    - `not-possible`, with reason `different-groups`, `cut-actor` or `no-cycle`. `no-cycle` also carries the rejections.
    - `GET /api/cycle` is unchanged; it now waits for the search.
  - **Tab 2:**
    - Shows `searching…` while waiting.
    - Then shows the Cycle, for example `length 3: Tom Irwin — Heat, Again — Uma Jones — Heat, Again — Sam Lee — Heat, Again — Tom Irwin`, or, fully red, "not possible: no cycle through all of them exists without repeating an actor".
    - The rejected branches are for the animation ticket (#11).
- **Tests:**
  - **Brute force agreement.** On 60 seeded random graphs, IDA* agrees with a brute-force enumeration of every simple cycle, for every 3 and 4 Actors sharing a block. That is over 2,000 Cycles found and 20+ "no cycle" cases.
  - **Validity.** Every Cycle found has all Chosen Actors, #1 first, no repeats, every Link a shared Movie, and it closes.
  - **Mutation check.** Making h overestimate by 1 fails 4 of the 6 search tests.
  - **Early stop.** K₂,₃₀₀ must answer `no-cycle` in under 1 s. It failed at 46.6 s before the fix.
  - **Small graphs:**
    - one Movie supplies every Link;
    - the k = 6 ring;
    - K₂,₃ (shares a block, but no Cycle);
    - `algorithms.md` §5.5's worked example, with its one rejected branch (Bob → Dan);
    - the 300 cap, with the rest counted.
  - **Tiny dataset (paper answers):**
    - Tom, Uma, Sam Lee 1970 → 3, every Link "Heat, Again".
    - Kevin, Sid, Xia → 4. Ada is outside the block, so she is never tried.
    - The ring → 6.
  - **Responsiveness.** A no-cycle graph takes ~0.8 s to exhaust, and a `/api/path` request sent after the Cycle request is answered first. Running the search on the request thread instead fails this test.
- **Bug found and fixed in the test helpers:**
  - The seeded random generator used by the blocks (D20) and iFUB (D17) property tests computed `state * 1103515245` in floating point, which loses the low bits past 2⁵³. `state % n` then became constant, and every random Movie's cast was `[0]`. Those tests were checking almost nothing.
  - Now one `seededRandom` in `src/server/testGraphs.ts` (32-bit, `Math.imul`, high bits) serves all of them. The blocks and iFUB tests still pass on the real random graphs.
- **Measured on the real data** (each time includes ~0.25 s to start the worker):
  - Bacon, Hanks, Streep → length 3 in 0.44 s.
  - Bacon, Pitt, DiCaprio, Cruise → 5 in 0.45 s.
  - Bacon, Pitt, DiCaprio, Cruise, Roberts, Freeman → 7 in 0.48 s.
  - Five random triples of mostly obscure Actors: lengths 8–18, 0.4–5.8 s. The slowest pruned 15.6 million branches.
- **Code review (`/code-review`, two parallel reviewers):**
  - **Spec:**
    - Every acceptance criterion is met.
    - IDA*, the closing condition and the rejection recording were checked correct.
    - Fixed: the repeated full passes after the search was already complete (the early stop above).
    - **Known gaps, kept on purpose (D9 asks for no time limit):**
      - A search keeps running after the browser leaves.
      - Nothing limits how many workers run at once.
      - The worker needs tsx at run time, which the `start` script already uses.
      - Revisit all three with D9's background-job option if Render shows a problem.
  - **Standards:**
    - No hard violations.
    - Fixed: the comments say "rejected", the glossary term, not "pruned".
    - Fixed: `finishFrom` → `lowerBoundFrom`, `extend` → `searchFrom`.
    - Fixed: the duplicated test helper `coStars` moved into `testGraphs.ts`.
    - Fixed: `largestPath.test.ts`'s own `randomGraph` (casts of 2–4) is renamed `randomPairedGraph`, so it no longer clashes with the shared one.
    - **Left as is (judgement calls):**
      - The index/id type pairs (`IndexLink`/`Link`), which follow the existing `IndexChain`/`Chain` split.
      - Reusing `chainText` for the Cycle line by appending Actor #1.
      - The two `expectValidCycle` helpers, one per layer (index and id).
- **Running time:**
  - Time: as D7. k · O(A + M + C) for the BFS runs, O(2ᵏ · k²) for Held–Karp, and O(A) to flag the block. Then the IDA* is exponential in the worst case, with at most (block size) passes, and it stops after the first pass that rejects nothing. Each node costs O(its Movies' casts + d log d) to list its d co-stars.
  - Space: O(k · A + M) for the distances and flags, plus the path (depth ≤ L) and one co-star list per level.
  - Per request, the worker also copies the Links: O(A + M + C).

## D22: Enter screen in code: a projected icosahedron with face-based hidden edges, a Bayer-dithered halftone field, a per-cell dissolve, and a character grid that redraws only changed cells (enter screen, ticket #9)

- **Date:** 2026-11-10
- **Why this is here:** these are rendering algorithms, not graph algorithms. `docs/agents/domain.md` says "when unsure, it goes in `DECISIONS.md`", so they are recorded here.
- **Decisions (as written in `src/web/enter/`):**
  - **Geometry is built, not typed in.** `icosahedron.ts` takes the 12 corners (0, ±1, ±φ) and their cyclic permutations. An edge joins two corners exactly 2 apart, which gives 30 edges. A face is three mutually joined corners, which gives 20 faces. The corners are scaled to the unit sphere.
    - Alternative: hard-code the 30 edges and 20 faces. Rejected: easy to mistype, and the test (12 / 30 / 20, all edges equal) checks the construction anyway.
  - **Turning and projecting.** Each frame turns the solid around its upright axis by an angle, then tilts it by a fixed 0.45 rad toward the viewer, so no face is ever seen exactly edge-on. It is then projected straight on (orthographic): (x, y, z) → (x, y). The result stays inside the unit disc, so the layout only needs one radius.
    - Alternative: perspective projection. Rejected: at character resolution the depth cue it adds is invisible, and orthographic keeps "fits inside radius R" exact.
  - **Hidden edges: back faces.** On a convex solid centred on the origin, a face points at the viewer when its centre has z > 0. An edge is hidden (drawn dotted, `--ink-dim`) only when **both** of its faces point away. Otherwise it is near (solid, `--ink`). Hidden edges are drawn first and near edges on top.
    - Alternative: a depth buffer per cell. Rejected: more work and more memory, and a convex solid needs no more than the face test.
    - Alternative: hide by the z of the edge's midpoint. Rejected: wrong near the silhouette, where an edge with one front face must stay solid.
  - **Lines on the grid: DDA with a glyph per slope.** A line takes max(|dx|, |dy|) evenly spaced, rounded steps. The glyph comes from the slope in cell units: `-` when |dx| > 3|dy|, `|` when |dy| > 1.5|dx|, otherwise `/` or `\` (screen y grows downward). Dotted lines fill every other step with `.` `:` `'` (design.md's dotted glyphs).
    - Alternative: Bresenham. Equivalent output for this purpose; the DDA is shorter.
  - **Round on screen.** Cells are taller than wide, so x is scaled by aspect = cell height ÷ cell width. The radius is 0.92 × half of min(rows, columns ÷ aspect).
  - **30 fps icosahedron, 60 fps around it.** The angle uses time snapped down to 1/30 s, so the solid changes on every other frame. The halftone field and the dissolve use the exact frame time.
  - **The title** is a FIGlet "standard"-style font (5 rows), limited to the letters of MOVIE STATISTICS. It is set as two centred lines, written on top of the edges, with its spaces kept so the edges don't cut through the letters.
  - **Halftone field: two slow sine waves, ordered (Bayer 4×4) dither.** tone(x, y, t) = max(0, ½ + ¼ sin(0.11x + 0.35t) + ¼ sin(0.23y + 0.05x − 0.27t) − ½) × 2. The glyph index is ⌊3·tone + Bayer threshold⌋ on the ramp space `·` `•` `●`. This is design.md's "Halftone and Dither" literally, with weight carried by the dot glyph, never opacity.
    - Alternative: random (noise) dither. Rejected: it shimmers from frame to frame. An ordered dither is stable, so between two 60 fps frames under 3% of cells change (tested).
    - Alternative: Floyd–Steinberg error diffusion. Rejected: it is sequential across the grid, and a tiny change in tone ripples across many cells, which is the opposite of "only redraw cells that changed".
  - **Dissolve: a per-cell schedule.** Each foreground cell gets a fixed pseudo-random number h in [0, 1) from a multiplicative hash of its index. With dissolve progress p in [0, 1], the cell's step is (p − 0.7h) / 0.3: the original glyph before 0, then `●` `•` `·`, then empty (the halftone shows through). Every cell is gone at p = 1. The dissolve takes 800 ms; then the screen is removed and the tabs are added.
  - **Two layers, one composite.** The front layer (edges and title) is a grid whose empty cells are `""`. The composite takes the front cell when there is one, and otherwise the halftone glyph.
  - **Redraw only changed cells.** `paintGrid` compares the new grid with the one on screen and repaints only the cells whose glyph or color differs (fill `--bg`, then the glyph). Resizing clears the comparison, so everything is repainted once. Cell edges are rounded to whole pixels, so fractional character widths leave no seams.
    - Alternative: clear and redraw the whole canvas each frame. Rejected: design.md asks for changed cells only, and most of the halftone field is still from frame to frame.
  - **Input.** The whole screen is one `<button>` holding the canvas (aria-hidden), labelled `[enter] movie statistics`. A mouse click enters only when it lands inside the icosahedron's projected disc. A keyboard press of the button (event detail 0) and Enter anywhere on the page also enter. A flag ignores repeats while dissolving. The title turns `--accent` while the pointer is over the disc.
  - **Reduced motion** skips the enter screen entirely and shows the tabs at once (an acceptance criterion).
  - **Font.** One `--font` token (JetBrains Mono, 400 and 700, from Google Fonts, falling back to `ui-monospace, Menlo, Consolas, monospace`) serves both the page and the canvas. The canvas measures its cells only after `document.fonts.load` has the font, because nothing else on the page uses it yet.
  - **Design-rule fix:** disabled buttons used `opacity: 0.4`, which design.md forbids. They are now drawn in `--ink-dim`.
  - **Dev-server fix:** the Vite proxy key `"/api"` also matched the module `/api.ts`, so under `vite` the app never mounted. It is now `"/api/"`.
- **Tests:** geometry (counts, equal edges, hidden edges seen from several angles, a full turn returns to the start); the line glyphs, dotted lines, clipping and changed cells; the title layout; the halftone ramp, its sparseness and its slow drift; the composed frame (title in the middle, inks, the 30 fps step, the dissolve ending in pure halftone, the hit test); and the DOM screen (reduced motion, Enter dissolves then leaves, the button enters, other keys don't).
- **Running time:** one frame is O(W·H) for a grid of W × H cells: the halftone and composite are O(1) per cell, the 30 edges are O(W + H) each, and the diff and paint are O(W·H) to compare, with fillRect/fillText only for changed cells. Memory is O(W·H) for three grids (front, composite, the one on screen). About 230 × 60 cells on a 1080p screen. Measured in Chrome: 60 frames in 1,000 ms.
