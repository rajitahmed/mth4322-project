# Algorithms: Study Guide

This guide explains how each algorithm in Movie Statistics works, why it gives the right answer, and how long it takes. Read it top to bottom; each section builds on the one before.

The short records of each decision are in `DECISIONS.md` (D1–D9). Terms in **bold capitals** (Actor, Movie, Link, Group, Cycle…) are defined in `CONTEXT.md`.

> Status: All three operations are decided (D1–D12).

---

## Contents

0. [Notation](#0-notation)
1. [The graph we search](#1-the-graph-we-search)
2. [BFS, the building block](#2-bfs-the-building-block)
3. [Operation 1a: Largest finite shortest path (iFUB)](#3-operation-1a-largest-finite-shortest-path-ifub)
4. [Operation 1b: Shortest path between two actors (bidirectional BFS)](#4-operation-1b-shortest-path-between-two-actors-bidirectional-bfs)
5. [Operation 2: Shortest Cycle (checks + IDA*)](#5-operation-2-shortest-cycle-checks--ida)
6. [Operation 3: Six Degrees of Bacon (BFS layers + DP)](#6-operation-3-six-degrees-of-bacon-bfs-layers--dp)
7. [Cheat sheet for presenting](#7-cheat-sheet-for-presenting)

---

## 0. Notation

| Symbol | Meaning |
|---|---|
| **A** | number of Actors |
| **M** | number of Movies |
| **C** | number of credits: (actor, movie) pairs, which are the edges of our graph |
| **d(x, y)** | Distance between Actors x and y: the fewest Links on any chain between them |
| **ecc(x)** | *eccentricity* of x: the largest d(x, y) over every y in x's Group, meaning "how far is the farthest actor from x?" |
| **k** | number of Chosen Actors in a Cycle search (3–6) |

The **diameter** of a Group is the largest ecc(x) over every x in it. The **largest finite shortest path** is the largest diameter across all Groups.

---

## 1. The graph we search

*(Decision D1)*

### The obvious way: actor–actor graph

Put an edge between every two actors who share a movie. A movie with 10 actors creates 10·9/2 = **45** edges, and every edge has to remember which movie(s) it came from.

### What we do: actor–movie graph (bipartite)

There are two kinds of nodes, **Actors** and **Movies**. An edge means "this actor is in this movie."

```
 Ann ─┐                    Ann ── Bob
 Bob ─┼── Heat     ==>      │ ╲  ╱ │      (what it means)
 Cat ─┘                    Cat ─────
 (what we store: 3 edges)   (3 links, all from Heat)
```

- A 10-actor movie costs **10** edges instead of 45.
- Getting from one actor to another always takes two steps: Actor → Movie → Actor. So:

> **Distance in Links = steps in the graph ÷ 2**

- A path through this graph alternates `Ann → Heat → Bob → Ronin → Dan`. That *is* the chain of movies the UI shows, so nothing extra has to be stored.
- Ratings live on Movie nodes, which tab 3 needs.

**Memory:** O(A + M + C).

### Groups

A **Group** is a set of actors who can all reach each other. One pass of BFS (or union-find) labels every actor with its Group, in O(A + M + C). Two actors in different Groups have **no finite Distance**, so the brief says to ignore those pairs.

---

## 2. BFS, the building block

*(Decision D2)*

Every Link counts as 1, so the graph is **unweighted**, and **breadth-first search (BFS)** finds exact shortest distances.

### How BFS works

1. Put the start actor s in a queue, with distance 0.
2. Repeatedly take the front node off the queue and look at its neighbors. Any neighbor not seen before gets distance (current + 1), is marked seen, and goes to the back of the queue.
3. Because the queue is first-in-first-out, nodes come out **in order of distance**: all distance-0 nodes, then all distance-1 nodes, and so on.

### Why BFS gives shortest distances

The first time BFS reaches a node, it arrives by the fewest possible steps. Any shorter route would have reached the node from a closer node, and all closer nodes were processed earlier. So a node's distance is fixed correctly the moment it is first seen.

### BFS on our actor–movie graph

- From an Actor, go to each of their Movies. From a Movie, go to each of its Actors.
- **Mark Movies visited too.** The first time a Movie is reached, it releases all of its actors at once and is never expanded again. This is what makes the bipartite graph fast: a big cast is processed once, not once per pair of actors.
- Record a **parent** for each node (the node we came from). To rebuild a path, follow parents back from the target.

**Running time:** O(A + M + C). Each node enters the queue at most once, and each edge is looked at at most twice. **Space:** O(A + M) for distances, parents, and the queue.

> **Why not Dijkstra's algorithm?** Dijkstra handles different edge weights using a priority queue, which costs O(E log V). With every weight equal to 1, it gives exactly BFS's answer, just slower.

---

## 3. Operation 1a: Largest finite shortest path (iFUB)

*(Decisions D3, D5)*

**Goal:** the largest ecc(x) over all actors x, measured within each actor's Group.

### 3.1 The naive way, our baseline

Run BFS from **every** actor, record how far its farthest actor is, and keep the overall maximum.

- It is obviously correct: it literally checks everyone.
- It costs **A BFS runs**, O(A·(A + M + C)). With tens of thousands of actors that is 10⁹–10¹⁰ steps, which takes minutes to hours.

iFUB gets the **same exact answer** with far fewer BFS runs.

### 3.2 The key idea: a single inequality

Pick any actor **u** (the "center"), and sort every actor into **layers** by distance from u:

```
L0 = {u}     L1 = actors 1 away     L2 = actors 2 away    ...    Le = the farthest layer
```

Take any two actors x and y that are both in layers ≤ j. Go from x to u, then from u to y:

> **d(x, y) ≤ d(x, u) + d(u, y) ≤ j + j = 2j**   (the triangle inequality)

So **two actors in the inner layers can't be very far apart.** The farthest pairs must involve an actor in an outer layer. That means only the outer layers need checking, and we can stop as soon as the inner layers can't possibly win.

### 3.3 iFUB step by step

```
lb ← best distance seen so far                 # a lower bound: the answer is at least lb
for i = e, e−1, e−2, ..., 1:                    # outer layers first
    for each actor x in layer Li:
        run BFS from x; lb ← max(lb, ecc(x))
    if lb > 2(i − 1):                           # the stop test
        return lb
return lb
```

**Why the stop test is safe.** We stop after finishing layer i. Every actor still unchecked is in layers 0 … i−1, so by 3.2 any two of them are at most 2(i−1) apart. We already have lb > 2(i−1), so no unchecked pair can beat lb.

**Why the answer is exact, not just "close."** Let the true diameter be D = d(x, y).
- If x or y is in a layer we processed, we ran BFS from it, so lb ≥ ecc(x) ≥ D.
- If both are in unprocessed layers, then D ≤ 2(i−1) < lb. That's impossible, because lb is always a real distance and so never more than D.

So when we stop, lb = D exactly.

### 3.4 Choosing a good center: the 4-sweep

iFUB is correct from **any** u. A good u, near the middle of the Group, keeps the outer layers small and makes the stop test succeed sooner. The **4-sweep** finds one using 4 BFS runs:

1. **r₁** = the actor with the most links in the Group (ties → lowest id).
2. BFS from r₁ → farthest actor **a₁**. BFS from a₁ → farthest actor **b₁**.
3. **r₂** = the actor halfway along the a₁→b₁ path (rebuilt from BFS parents).
4. BFS from r₂ → **a₂**. BFS from a₂ → **b₂**.
5. **u** = the actor halfway along the a₂→b₂ path.

**Intuition:** two actors that are far apart sit near opposite edges of the Group, so the midpoint of the path between them is near the center. Doing it twice refines the guess.

**A free head start:** every distance seen during the sweeps (like d(a₁, b₁)) is a real distance, so lb starts at the best of them. Often lb already equals the true diameter after the sweeps, and iFUB only has to *prove* it.

### 3.5 Every Group, not just the big one

Run iFUB on **each** Group and take the largest answer. A small Group, such as a long chain of actors linked by obscure movies, can have a **bigger** diameter than the huge main Group. Small Groups cost very little.

### 3.6 Worked example

```
A ── B ── C ── D ── E        (each ── is a movie shared by two actors)
          │
          F
```

- **4-sweep:** C has the most links (B, D, F), so r₁ = C. BFS from C: the farthest actors are A and E (distance 2), and the tie goes to the lowest id, so a₁ = A. BFS from A: farthest is E at distance **4**, so b₁ = E and lb = 4. The midpoint of A–B–C–D–E is C, so r₂ = C, and the second sweep gives the same result. **u = C.**
- **Layers from C:** L0 = {C}, L1 = {B, D, F}, L2 = {A, E}, so e = 2.
- **i = 2:** BFS from A gives ecc 4. BFS from E gives ecc 4. lb = 4.
- **Stop test:** is lb > 2(2−1) = 2? Yes, 4 > 2, so we stop. **The answer is 4** (A to E).

On a tiny graph this doesn't save any BFS runs. On a real collaboration graph with tens of thousands of actors, the stop test usually passes after **a few dozen** BFS runs instead of tens of thousands.

### 3.7 Running time

- **Worst case:** O(A·(A + M + C)), the same as naive. In theory the stop test might not pass until the inner layers.
- **In practice:** O(k·(A + M + C)) with k = 4 (sweep) + 1 (layers from u) + the actors checked, usually a few dozen. Real social graphs have a dense core and short distances, so the outer layers are small.
- **Space:** O(A + M).
- **When it runs:** once, when the server starts. The result is kept in memory (D5).

### 3.8 The answer and the animation

- **The answer is the number (the distance).** The pair of actors and the chain of movies are one example that proves it (D5). Ties go to the lowest actor id.
- The animation does **not** replay iFUB, which would be dozens of full searches. Instead it runs **bidirectional BFS (section 4) between the two endpoints iFUB found**, so it looks exactly like the optional two-actor search.

---

## 4. Operation 1b: Shortest path between two actors (bidirectional BFS)

*(Decision D4)*

**Goal:** d(s, t) and one shortest chain of movies, or "no path" if s and t are in different Groups.

### 4.1 The idea

Plain BFS from s spreads out like a ball until it touches t, with radius d. **Bidirectional BFS** grows **two** balls, one from s and one from t, and stops when they touch. Each has radius about d/2.

In a graph where each actor reaches about b new actors per step, a ball of radius d holds about bᵈ actors. Two balls of radius d/2 hold about 2·b^(d/2), which is **roughly the square root** of the work. With b = 50 and d = 6, that's about 15,600,000,000 versus about 250,000.

### 4.2 Step by step

```
frontS = {s}, seenS = {s: 0}       frontT = {t}, seenT = {t: 0}
best = ∞
while frontS and frontT are both non-empty:
    pick the side whose frontier has fewer actors          # keeps the work balanced
    expand that ENTIRE frontier by one layer:
        for each newly discovered node n:
            record its distance and parent
            if the other side has also seen n:              # the balls touch here
                best = min(best, distS(n) + distT(n))
    if best < ∞: stop, rebuild the path through the best meeting node
if a frontier became empty without meeting: no path → s and t are in different Groups
```

Work in actor–movie graph steps and divide by 2 at the end, exactly as in BFS.

### 4.3 Why it's correct

Say the two sides have fully explored to depths a (from s) and b (from t) without meeting, and the next layer from s produces a meeting.
- **No shorter path exists.** A path of length ≤ a + b would have a node within a of s *and* within b of t. Both sides would already have seen it, so they would have met earlier.
- **The meeting found has length a + 1 + b.** It is a shortest path.

Checking for meetings **at the moment a node is discovered**, and expanding **full layers**, is what makes this work. We still finish the layer and keep the shortest meeting, which is a cheap safety rule.

> **The classic bug:** if the two sides expand *one node at a time*, alternating, and check for a meeting only when a node is *removed* from the queue, stopping at the first meeting can return a path **one Link too long**. Expanding full layers avoids this.

### 4.4 Why we chose it

- **Speed:** roughly the square root of plain BFS's work in practice.
- **Animation payload:** results must include explored and rejected links. Plain BFS can touch most of the database, while bidirectional BFS touches a few thousand links.
- **It reads well on a projector:** two searches growing toward each other and meeting.

### 4.5 Running time

Worst case O(A + M + C), the same as BFS. In practice, far less. Space O(A + M).

---

## 5. Operation 2: Shortest Cycle (checks + IDA*)

*(Decisions D6–D9)*

**Goal:** given k = 3–6 Chosen Actors, find the shortest **Cycle**: a closed chain that visits all of them, may pass through other actors, **never repeats an actor**, and **may reuse a movie**. Or report "not possible" and why.

### 5.1 Why this one is hard

If k equals *every* actor, the question becomes "is there a cycle through everyone?" That is the **Hamiltonian cycle problem**, which is **NP-hard**: no fast (polynomial-time) algorithm is known. So no fast exact algorithm is known for our problem either. The brief explicitly allows non-polynomial time. Our job is to make the exponential search **small in practice**.

### 5.2 The movie-reuse rule, and what it means for the search

Ann, Bob and Cat are all in *Heat*:

```
Ann ─Heat─ Bob ─Heat─ Cat ─Heat─ Ann      ← a valid Cycle of length 3
```

In the actor–movie graph, this Cycle passes through the *Heat* node **three times**. So the search marks **Actors** as used (no repeats) but **never marks Movies**: they can be passed through again and again.

### 5.3 Checks before the search

The first two checks are fast, and they explain the most common "not possible" answers in plain words.

**Check 1: Different Groups.** If two Chosen Actors are in different Groups, no chain links them at all, so no Cycle exists. This takes O(1) using the Group labels computed at startup.

**Check 2: No shared biconnected block.**

- A **cut actor** is an actor whose removal splits the graph into pieces.
- A **biconnected block** is a largest-possible piece of the graph with **no cut actor inside it**. Between any two actors in it there are always at least two routes that share no actor.
- **The key fact: a simple Cycle always lies entirely inside one block.** To leave a block and come back, you would have to pass through the cut actor twice, and repeats aren't allowed.

```
   Ann ─ X ─┐            ┌─ Y ─ Bob
            Cat (cut)  ──┤
   Ann ─ Z ─┘            └─ W ─ Bob
```

Every route from Ann to Bob passes through Cat, so any Cycle containing both would have to visit Cat twice. The result is fully red: *"Every route from Ann to Bob passes through Cat."*

The simplest case is an actor with only **one co-star**. That co-star is a cut actor for them, so no Cycle can include them.

**How blocks are found:**
- **Tarjan's algorithm** is one DFS that tracks, for each node, the earliest-discovered node its subtree can reach back to (its "low-link"). When a child can't reach back above its parent, the parent is a cut point and the edges just explored form a block. It takes O(A + M + C).
- Because Movies can be reused, a Movie is **never** a real cut point. So we take Tarjan's blocks of the actor–movie graph and **merge any blocks that meet only at a Movie node**. What remains are the blocks of the actor graph, where only Actors act as cut points.
- This runs **once at startup**. Each request just checks whether one block contains all k Chosen Actors.

**Check 3: Search, but only inside that block.** Every actor outside the block is ignored. This often removes most of the graph.

**Check 4: The search runs out.** Sharing a block guarantees a Cycle through any **2** actors, but **not always through 3 or more**.
- Counter-example (K₂,₃): 2 "hub" actors and 3 others, where each of the 3 is linked only to both hubs. A Cycle through all 3 would need to alternate other, hub, other, hub, other, hub. That takes 3 hubs, but there are only 2.
- So if the search's budget passes the number of actors in the block (no Cycle can be longer than that), the answer is fully red: *"No cycle through all of them exists without repeating an actor."* This also guarantees the search always ends.

### 5.4 The search: IDA* (iterative deepening with a lower bound)

#### Ingredient 1: exact distances

Run **BFS from each Chosen Actor** inside the block, k runs in total. Now d(v, cᵢ) is known for every actor v and every Chosen Actor cᵢ.

#### Ingredient 2: a lower bound h for finishing (the "heuristic")

Suppose we're partway through building a Cycle. We're at actor v, and the Chosen Actors R = {r₁, r₂, …} still have to be visited before returning to Chosen Actor #1 (call it c₁). Then:

> **h(v, R) = the minimum, over every order of R, of d(v, r₁) + d(r₁, r₂) + … + d(r_last, c₁)**

That is the shortest possible finish if paths were allowed to overlap.

- With at most 5 Chosen Actors left, there are at most 5! = 120 orders, a tiny brute-force.
- Optional speed-up: precompute the best tour of every subset of Chosen Actors once, using the Held–Karp bitmask method, so each h becomes a few lookups.

**Why h never overestimates.** Any real finish has to visit R in *some* order. Each leg is a real path, so it's at least as long as the BFS distance, and the no-repeat rule can only make legs longer. So real finish ≥ h. A lower bound that never overestimates is called **admissible**.

#### Ingredient 3: depth-first search with a budget L

```
L ← h(c₁, all other Chosen Actors)          # the best Cycle conceivable
loop:
    if L > (actors in block): return NOT POSSIBLE          # check 4
    result ← DFS(c₁, length=0, used={c₁}, remaining=Chosen − {c₁})
    if result: return result                               # the first one found is the shortest
    L ← L + 1

DFS(v, length, used, remaining):
    if length + h(v, remaining) > L: prune (rejected branch)       # can't finish within budget
    for each actor w linked to v, in order of lowest id:
        if w == c₁ and remaining is empty and length + 1 == L: return the Cycle   # closed!
        if w not in used:
            mark w used; if w is Chosen, remove it from remaining
            if DFS(w, length+1, used, remaining) returns a Cycle: return it
            unmark w, restore remaining                                    # backtrack
    return nothing
```

- "Actors linked to v" means: for each Movie of v, each other actor in it. Movies are **not** marked used, which is the reuse rule.
- Trying neighbors in order of lowest id keeps results deterministic, so replays match (D8).

#### Why IDA* returns the shortest Cycle

1. **Pruning never removes a Cycle that fits the budget.** We prune only when length + h > L. Since h is a lower bound, any Cycle through that branch is longer than L.
2. **Budgets go up one at a time.** When the DFS at budget L finds a Cycle, every budget L′ < L was searched completely and found nothing. So no shorter Cycle exists.

Together, **the first Cycle found is a shortest one.**

#### Why "iterative deepening" instead of one search with no budget

- A plain DFS with no budget wanders down extremely long paths first.
- A BFS-style search (like A* with a priority queue) would store a huge number of partial paths, which is a memory problem on a 512 MB server.
- IDA* gets the shortest-first guarantee **and** only uses memory for the current path (depth L).
- Re-running the cheap early passes costs little, because each pass is usually much bigger than all the passes before it combined.

### 5.5 Worked example

Chosen Actors: Ann (c₁), Bob, Cat.

```
Movies:  Heat = {Ann, Bob, Cat}     Ronin = {Bob, Dan}     Tenet = {Dan, Cat}
```

- BFS distances: d(Ann,Bob) = 1, d(Bob,Cat) = 1, d(Cat,Ann) = 1.
- Starting budget: L = h = d(Ann,Bob) + d(Bob,Cat) + d(Cat,Ann) = **3**.
- **DFS at L = 3:** Ann → Bob (via *Heat*), length 1, remaining {Cat}, h = d(Bob,Cat) + d(Cat,Ann) = 2, and 1 + 2 = 3 ≤ 3, so continue.
  - Bob → Cat (*Heat*), length 2, remaining {}, h = d(Cat,Ann) = 1, and 2 + 1 = 3 ≤ 3, so continue.
  - Cat → Ann (*Heat*): closed with length 3 = L. ✓
- **Answer: 3.** Ann –*Heat*– Bob –*Heat*– Cat –*Heat*– Ann. This is the "same movie for multiple connections" case the brief asks to test.
- If Bob → Dan had been tried first: length 2, remaining {Cat}, h = d(Dan,Cat) + d(Cat,Ann) = 1 + 1 = 2, and 2 + 2 = 4 > 3, so it is **pruned** (shown red in the animation).

### 5.6 Running time

| Part | Cost |
|---|---|
| Group labels + Tarjan's blocks | O(A + M + C), **once at startup** |
| Checks 1–2 per request | about O(k) lookups |
| k BFS runs | k·O(A + M + C) |
| IDA* | worst case **exponential**: about O(b^L) per pass (b = neighbors per actor), at most (block size) passes |
| Space | O(A + M) + a DFS stack of depth L |

This is allowed: the problem is NP-hard and the brief permits non-polynomial time. In practice the block restriction and the lower bound h prune most branches, especially when the Chosen Actors are reasonably close together.

### 5.7 Answer, animation, long searches

- **The answer is the length**, or "not possible" with one of three reasons: *different Groups*, *cut actor*, or *no cycle exists*. The Cycle itself is one example (D8).
- **Animation:** the Cycle plus up to ~300 rejected branches from the **final** pass, with "+ N more branches tried" if the list was cut short (D8).
- **No time limit:** the search runs in a separate worker so the rest of the site stays responsive. If Render's request timeout becomes a problem, upgrade to a background job with polling (D9).

---

## 6. Operation 3: Six Degrees of Bacon (BFS layers + DP)

*(Decisions D10–D12)*

**Goal:** from one **Center** actor (Kevin Bacon by default), show every **Layer** (all actors at Distance 1, 2, 3, …), how many actors are in each, which actors can't be linked at all, and for any picked actor, the chain of films back to the Center, in either **shortest-link** or **best-rated** mode.

### 6.1 Layers: just BFS

Run one BFS from the Center (section 2). BFS discovers actors in order of distance, so:

- **Layer i** = every actor BFS gave distance i (in actor–movie graph steps, 2i).
- **Can't be linked** = every actor BFS never reached. Those are exactly the actors outside the Center's Group.
- **The rings in the animation** are these Layers, drawn one at a time from the inside out.

Layers are **the same in both modes** (D10). "Six degrees" means Distance, so an actor's ring never moves. Only the chain shown for a picked actor depends on the mode.

### 6.2 Shortest-link chain: BFS parents

When BFS first discovers actor v, it records who discovered it (its **parent**) and through which Movie. Following parents back to the Center gives **a** shortest chain. Neighbors are tried in order of lowest id, and the lowest-id Movie is used when two actors share several, so the result is always the same. This mode has **no rating preference**: it's just the first shortest chain BFS found.

### 6.3 Best-rated chain: dynamic programming on the shortest-path DAG

An actor in Layer 3 may have hundreds of different shortest chains back to the Center. Best-rated mode picks the one whose Movies have the **highest average rating**. Every candidate has the same length d, so the highest average is the same as the **highest sum**.

Listing every shortest chain is hopeless, because their number grows exponentially. **Dynamic programming (DP)** solves it in one linear pass. Here's why it applies.

**Step 1: Turn the Layers into a graph with no cycles.** Keep only the links that step **outward**, from Layer i−1 to Layer i. Links inside a Layer, or pointing inward, can never be on a *shortest* chain, so drop them. What's left only points outward, so it can't loop back on itself. This is the **shortest-path DAG** (directed acyclic graph).

```
Layer 0        Layer 1          Layer 2
            ┌─► Ann ──(8.3)──┐
 Kevin ─────┤                ├──► Cat
            └─► Bob ──(7.2)──┘
```

**Step 2: Define the subproblem.**
> **best(v)** = the highest total rating of any shortest chain from the Center to v.

**Step 3: Optimal substructure (why the recurrence is right).** Say the best chain to v ends `… → p →(m)→ v`. Then the part `Center → … → p` **must be the best chain to p**. If p had a better one, swapping it in would give a better chain to v, which contradicts "best." So:

> **best(Center) = 0**
> **best(v) = max over each p in Layer i−1 and each Movie m shared by p and v of [ best(p) + rating(m) ]**

Store the winning (p, m) as v's **choice**. Following choices back to the Center rebuilds the best-rated chain, just like BFS parents.

**Step 4: Overlapping subproblems (why it's fast).** A popular actor p in Layer 2 may be a predecessor of thousands of actors in Layer 3. best(p) is computed **once** and reused by all of them. That reuse is the whole point of DP. Without it, you'd be re-walking every chain.

**Step 5: Order of computation.** Every predecessor sits in an **earlier** Layer. So computing Layer 1, then Layer 2, then Layer 3, which is BFS order, guarantees best(p) is ready before any v needs it. (In DAG terms, BFS Layer order is a **topological order**.)

**On our actor–movie graph** each Layer is processed in two small steps:
1. **Movies first:** for each Movie m that links Layer i−1 to Layer i, take movieBest(m) = the max of best(p) over m's actors p in Layer i−1.
2. **Then actors:** for each actor v in Layer i, take best(v) = the max of movieBest(m) + rating(m) over v's Movies m that were reached from Layer i−1.

Each credit is looked at once, so the pass is **O(A + M + C)**. When two actors share several Movies, the max automatically uses the best-rated one.

> **The name to use when presenting:** this is **longest path in a DAG**. On a general graph, finding the longest path is NP-hard. On a DAG it's **linear time**, because you can process nodes in topological order and every subproblem is ready when needed.

### 6.4 Worked example

```
Kevin ─(Apollo 13, 7.7)─ Ann ─(Heat, 8.3)── Cat
Kevin ─(Footloose, 6.5)─ Bob ─(Ronin, 7.2)─ Cat
```

- **BFS:** Layer 1 = {Ann, Bob}, Layer 2 = {Cat}.
- **DP, Layer 1:** best(Ann) = 0 + 7.7 = 7.7. best(Bob) = 0 + 6.5 = 6.5.
- **DP, Layer 2:** best(Cat) = max(7.7 + 8.3, 6.5 + 7.2) = max(**16.0**, 13.7) = 16.0 → choice (Ann, *Heat*). Average = 16.0 / 2 = **8.0**.
- **Best-rated chain:** Cat ← *Heat* ← Ann ← *Apollo 13* ← Kevin.
- **Shortest-link chain:** if Bob has the lower id, BFS discovered Cat through Bob, so it shows Cat ← *Ronin* ← Bob ← *Footloose* ← Kevin.
- **Different links, same Layer.** This is the brief's test case.

### 6.5 What the browser gets, and caching

- **First response:** per-Layer counts, the actors needed to draw each ring (sampled when a ring has more actors than screen cells), and the can't-be-linked count (D12).
- **Clicking an actor:** the server walks choices or parents back to the Center, which is O(d), and returns that one chain.
- **The can't-be-linked list:** on request, paged and searchable. It can be large.
- **Caching:** Kevin Bacon is computed at startup. Other Centers are computed on request, and the last ~8 are kept (least-recently-used).

### 6.6 Running time

| Part | Cost |
|---|---|
| BFS (Layers, parents, can't be linked) | O(A + M + C) |
| DP (best-rated choices) | O(A + M + C), in the same pass |
| Cached Center | O(1) |
| One chain lookup | O(d) |
| Memory | O(A + M) per Center, about 8 Centers cached |

---

## 7. Cheat sheet for presenting

| Operation | Algorithm | Why it's correct (one line) | Running time |
|---|---|---|---|
| Graph | Bipartite actor–movie graph | Distance = steps ÷ 2; a movie is expanded once | memory O(A+M+C) |
| Shortest path (one source) | BFS | The queue releases nodes in distance order | O(A+M+C) |
| Largest finite shortest path | iFUB + 4-sweep, per Group | Two inner-layer actors are ≤ 2(i−1) apart (triangle inequality), so stop once lb beats that | worst O(A·(A+M+C)), in practice a few dozen BFS |
| Two-actor shortest path | Bidirectional BFS, full layers | No earlier meeting ⇒ no path of length ≤ a+b | worst O(A+M+C), in practice about √ of plain BFS |
| Shortest Cycle | Group check → block check (Tarjan) → IDA* in the block | A Cycle stays inside one block; h never overestimates + budgets go up one at a time ⇒ the first Cycle found is shortest | NP-hard; worst case exponential, about O(b^L) |
| Six Degrees Layers | BFS from the Center | Layer i = BFS distance i; not reached = can't be linked | O(A+M+C) |
| Best-rated chain | DP on the shortest-path DAG (longest path in a DAG) | The prefix of a best chain is a best chain; Layer order is topological | O(A+M+C) |

**Questions you might be asked:**

- *"Why not just run BFS from everyone?"* It's correct but costs A BFS runs. iFUB gives the same exact answer and usually needs only a few dozen.
- *"Is iFUB's answer approximate?"* No. The stop test only skips actors that provably can't beat the current best.
- *"Why is the cycle search exponential?"* It contains the Hamiltonian cycle problem, which is NP-hard. The brief allows this.
- *"How do you know the cycle is the shortest?"* The lower bound never overestimates, and budgets increase one at a time, so nothing shorter was skipped.
- *"Why can a cycle reuse a movie?"* The brief allows it. The search only forbids repeating an actor.
- *"Why not Dijkstra?"* All Links weigh 1, so BFS gives the same result faster.
- *"Why doesn't best-rated move actors between rings?"* Rings mean Distance. Best-rated only chooses among the **shortest** chains.
- *"Isn't longest path NP-hard?"* On general graphs, yes. Our shortest-path DAG has no cycles, so DP solves it in linear time.
