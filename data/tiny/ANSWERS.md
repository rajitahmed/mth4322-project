# Tiny dataset: paper answers

17 Actors, 16 Movies, 2 Groups. Same three CSV files and loader as the real data.
Ids are in file order, so "lowest id" means "earliest row".

## The picture

Each line is a Link, labelled with its Movie and rating.

```
Group 1 (14 Actors)

                         Pia Holt (nm08)
                            |  Lone Star 7.2
                         Dev Ennis (nm05)
        Ring Three 6.7  /            \  Ring Four 6.5
          Cara Diaz (nm04)          Eve Ford (nm06)
        Ring Two 6.8    |            |  Ring Five 6.6
          Ben Cole (nm03)           Finn Gray (nm07)
        Ring One 6.9    \            /  Ring Six 6.4
                          Ada Hart (nm02) ---- Side Door 7.3 ---- Tom Irwin (nm09)
                            |  Open Road 7.0                          |  "Heat, Again" 8.0
                          Kevin Bacon (nm01)                     Uma Jones (nm10), Sam Lee 1970 (nm11)
        Low Tide 6.2    /            \  High Noon Redux 8.5         (all three are in "Heat, Again")
          Sid Moss (nm12)           Sue Nash (nm13)
        Low Tide 2 6.3  \            /  High Noon Redux 2 8.8
                          Xia Ortiz (nm14)

Group 2 (3 Actors, no Movie links them to Group 1)

  Sam Lee 1988 (nm15) -- Far Shore 7.4 -- Gus Price (nm16) -- Far Shore 2 7.5 -- Gia Quinn (nm17)
```

## Required cases

| Case | Where |
| --- | --- |
| Two Groups with no Movie linking them | Group 1 = nm01–nm14, Group 2 = nm15–nm17 |
| One Movie with 3+ Actors | "Heat, Again" (Tom, Uma, Sam Lee 1970) |
| Movies with different ratings | 6.2 to 8.8 |
| A cut actor | Dev Ennis: Pia Holt's only co-star |
| Exactly one farthest pair | Pia Holt and Xia Ortiz, Distance 7 |
| Shortest and best-rated chains differ | Xia Ortiz, from Kevin Bacon |
| A Cycle only possible by reusing one Movie | Tom, Uma, Sam Lee 1970 through "Heat, Again" |
| A k = 6 Cycle | the ring Ada, Ben, Cara, Dev, Eve, Finn |
| An Actor who can't be linked to the Center | Sam Lee 1988, Gus Price, Gia Quinn |
| Two Actors with the same name | Sam Lee (1970) and Sam Lee (1988) |
| A missing birth year | Uma Jones |

## Groups

- Group 1: nm01–nm14 (14 Actors).
- Group 2: nm15, nm16, nm17 (3 Actors).

## Operation 1: largest finite shortest path

**Distance 7, between Pia Holt and Xia Ortiz.** It is the only pair at 7.

Pia → Dev → Cara → Ben → Ada → Kevin → Sid → Xia
(Lone Star, Ring Three, Ring Two, Ring One, Open Road, Low Tide, Low Tide 2).
The way round through Eve and Finn, or through Sue, is also 7 Links.

Why nothing else reaches 7: everything else sits closer to the middle.
Xia's next farthest Actor is Dev (6). Uma and Sam Lee 1970 are at most 6
from anyone (6 to Pia). Group 2's largest Distance is only 2 (Sam Lee 1988 to
Gia Quinn), and pairs across Groups have no finite Distance, so they are ignored.

Two-actor paths:
- Kevin Bacon → Dev Ennis: Distance 4.
- Kevin Bacon → Gia Quinn: no path (different Groups).

## Operation 2: shortest Cycle

| Chosen Actors | Answer |
| --- | --- |
| Tom Irwin, Uma Jones, Sam Lee 1970 | **3**, every Link from "Heat, Again". Uma and Sam are in no other Movie, so a Cycle exists only by reusing it. |
| Kevin Bacon, Sid Moss, Xia Ortiz | **4**: Kevin → Sid → Xia → Sue → Kevin. Kevin and Xia share no Movie, so 3 is impossible. |
| Ada, Ben, Cara, Dev, Eve, Finn (k = 6) | **6**: the ring. |
| Pia Holt, Dev Ennis, Ada Hart | **Not possible, cut actor Dev Ennis.** Pia has one co-star, so no Cycle can enter and leave her. |
| Kevin Bacon, Ada Hart, Sam Lee 1988 | **Not possible, different Groups.** |

## Operation 3: Six Degrees of Bacon (Center: Kevin Bacon)

| Layer | Actors | Count |
| --- | --- | --- |
| 0 | Kevin Bacon | 1 |
| 1 | Ada Hart, Sid Moss, Sue Nash | 3 |
| 2 | Ben Cole, Finn Gray, Tom Irwin, Xia Ortiz | 4 |
| 3 | Cara Diaz, Eve Ford, Uma Jones, Sam Lee 1970 | 4 |
| 4 | Dev Ennis | 1 |
| 5 | Pia Holt | 1 |
| can't be linked | Sam Lee 1988, Gus Price, Gia Quinn | 3 |

Shortest and best-rated chains:

- **Xia Ortiz (differ).** Shortest (lowest ids): Kevin → Low Tide → Sid → Low Tide 2 → Xia,
  ratings 6.2 + 6.3 = 12.5 (average 6.25). Best-rated: Kevin → High Noon Redux → Sue →
  High Noon Redux 2 → Xia, ratings 8.5 + 8.8 = 17.3 (average 8.65).
- **Dev Ennis (same).** Through Ben and Cara: 7.0 + 6.9 + 6.8 + 6.7 = 27.4. Through Finn and
  Eve: 7.0 + 6.4 + 6.6 + 6.5 = 26.5. The lowest-id chain is also the best-rated one.

## Autocomplete

- `sam` → Sam Lee (1970), Sam Lee (1988).
- `bacon` → Kevin Bacon (1958). Matching starts at any word of the name.
