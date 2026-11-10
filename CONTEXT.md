# Movie Statistics

Statistics over the actors of well-rated IMDb feature films and the movies that link them.

## Language

**Movie**:
A feature film with a rating of at least 6.1 from at least 1,100 votes.
_Avoid_: Title, film

**Actor**:
Anyone credited as actor or actress in the principal cast of at least one Movie.
_Avoid_: Cast member, person

**Link**:
Two Actors are linked when they share at least one Movie. A Link remembers every Movie it comes from.
_Avoid_: Edge, connection

**Distance**:
The fewest Links on any chain between two Actors. Every Link counts as 1, whatever its Movie.
_Avoid_: Hops, degrees

**Group**:
A set of Actors where each one can reach every other through Links, and no Actor outside the set can reach them. Actors in different Groups have no finite Distance.
_Avoid_: Component, cluster, island

**Chosen Actor**:
One of the 3 to 6 distinct Actors the user picks for a Cycle search.
_Avoid_: Terminal, input actor

**Cycle**:
A closed chain of Links that visits every Chosen Actor, may pass through other Actors, and never repeats an Actor. A Movie may supply more than one of its Links. Its length is its number of Links.
_Avoid_: Loop, ring, tour

**Center**:
The one Actor a Six Degrees search starts from (Kevin Bacon by default).
_Avoid_: Source, root, hub

**Layer**:
All Actors at the same Distance from the Center. Layers are the same in both link modes.
_Avoid_: Ring, level, degree

**Largest finite shortest path**:
The largest Distance between any two Actors in the same Group, across all Groups.
_Avoid_: Diameter, longest path
