# Design Doc: Movie Statistics

## Problem Statement

A billionaire who loves movies hired us to prepare a program for him using data from the Internet Movie Database (IMDb). He only wants movies that have a rating of at least 6.1, based on at least 1,100 votes, and the actors who played in at least one such movie.  
Two actors are connected if they played in a movie together. The program must support 3 operations:

- Find the largest finite shortest-path distance between two actors.  
- Given k \>= 3 distinct actors, find the shortest cycle possible that contains all k actors. The cycle may not repeat an actor more than once, but may use the same movie for multiple connections.

## Plan

Let's create a full-stack app that has the Movie Database we access with all the actors and their associated movies,to assist with the heart of our program. AI assists with the algorithms to be created for the 3 operations.

The user starts at an enter button, where the enter button is the big text in ASCII saying MOVIE STATISTICS inside an icosahedron. After entering, the user has 3 tabs for the 3 different operations:

- Largest finite shortest-path  
  - User Gives: Nothing for the main answer. Optionally, two actors.  
  - User Sees: A live linking animation that sparkles out and shows the largest finite shortest path: the two actors, the distance, and the chain of movies between them. The optional search shows the shortest path between the two actors entered.  
- Shortest cycle  
  - User Gives: 3 to 6 distinct actors  
  - User sees: An animation of the shortest cycle that contains all of them, or that it is not possible and why.  
- Six Degrees of Bacon:  
  - User Gives: One actor (Kevin Bacon by default)  
  - User Sees: Circles inside circles: every step another layer gets added showing all the actors within that layer until finished. The user can choose between the shortest link and the best-rated link.

## Prereqs

- Need to download data from IMDb to get all movies that have a rating of at least 6.1, based on at least 1,100 votes. The data comes from the official IMDb non-commercial dataset files, not from scraping.  
- Store all data in a data file that ships with the application, to perform the bulk of this project. (CSV file or a small .db file)  
- A movie is a feature film only (no TV movies, shorts, videos, or episodes) that passes the rating and votes filter.  
- An actor is anyone credited as an actor or actress in at least one such movie.

## User Stories

### Enter Screen and Tabs

* As the user, I want an enter button that is the big text in ASCII saying MOVIE STATISTICS inside an icosahedron, so that the site opens with a clear starting point.  
* As the user, I want to press the enter button and land on the operations, so that I can start right away.  
* As the user, I want 3 tabs for the 3 different operations, so that I can switch between them at any time.  
* As the user, I want every actor field to have autocomplete based on our database, so that I can only pick actors that are in our data.  
* As the user, I want autocomplete to tell actors with the same name apart, so that I pick the right one.  
* As the user, I want a fully red result to always mean not possible, so that a failed search looks the same on every tab.  
* As the user, I want one color rule on every tab, where a green path means part of the answer and a red path means explored and rejected, so that I can read any animation the same way.  
* As the user, I want to be able to replay an animation, so that I can show it again while presenting.

### Tab 1: Largest finite shortest-path

* As the user, I want to press one button with no actor fields to fill in, so that I get the largest finite shortest-path distance between two actors in the whole database.  
* As the user, I want a live linking animation that goes on until it reaches the end, so that I can watch the path being found.  
* As the user, I want the animation to sparkle out and show the largest finite shortest path, so that the answer has a clear finish.  
* As the user, I want to see the two actors, the distance, and the chain of movies between them, so that I can check the answer myself.  
* As the user, I want two optional fields to put for actors, so that I can also find the shortest path between any two actors I choose.  
* As the user, I want the same live linking animation for my two actors, so that both searches on this tab look the same.  
* As the user, I want to be told when my two actors have no path between them, shown as a fully red result, so that I know it is not possible.

### Tab 2: Shortest cycle

* As the user, I want to start with 3 actor fields, so that I can give the minimum of k \= 3 distinct actors.  
* As the user, I want an add actor button that goes up to 6 actors, so that I can try larger values of k.  
* As the user, I want to be stopped from entering the same actor twice, so that the actors are always distinct.  
* As the user, I want to enter any actors from our database, so that I am not limited to actors known to work.  
* As the user, I want an animation that shows the shortest cycle that contains all my actors, so that I can watch the cycle close.  
* As the user, I want to see the movie used for each connection in the cycle, including when the same movie is used for multiple connections, so that I can check the cycle.  
* As the user, I want to see that no actor is repeated in the cycle, so that I know the rule was followed.  
* As the user, I want to be shown when a cycle is not possible and why, as a fully red result, so that I understand the outcome.

### Tab 3: Six Degrees of Bacon

* As the user, I want Kevin Bacon to be the default actor, so that I can run the classic Six Degrees of Bacon right away.  
* As the user, I want to put in any actor instead of Kevin Bacon, so that this works for any actor input.  
* As the user, I want circles inside circles, where every step another layer gets added showing all the actors within that layer until finished, so that I can see how far everyone is from the chosen actor.  
* As the user, I want to see how many actors are in each layer, so that I can compare the layers.  
* As the user, I want to pick an actor in any layer and see the films linking them back to the center, so that I can link any arbitrary Hollywood actor to Kevin Bacon.  
* As the user, I want to choose between the shortest link and the best-rated link, so that the movie ratings are part of this operation.  
* As the user, I want to see which actors cannot be linked to the chosen actor at all, so that I know who is left out.

### Sharing and presenting

* As the user, I want the site hosted on Render, so that I can share it with a link.  
* As the presenter, I want a tiny hand-made dataset with answers I can work out on paper, so that I can explain each operation and show that it is correct.  
* As the user, I may want a separate page which explains the project, reached from the top right, so that visitors can read about it if need be.

## Implementation Decisions

### Data

* The data comes from the official IMDb non-commercial dataset files: ratings (rating and number of votes), titles (title type), principal cast (who played in what, and their job category), and names (actor names).  
* A one-time script downloads the files, applies the filter, and writes the data file. It runs on the developer's computer, not on Render.  
* The filter keeps titles of type movie with a rating of at least 6.1 and at least 1,100 votes, and keeps people credited as actor or actress in at least one such movie.  
* Potential schema: Actors \-\> Movies. Each actor has an id, a name, and their associated movies. Each movie has an id, a title, a year, a rating, a number of votes, and its actors.  
* Two actors are connected if they played in a movie together. Each connection remembers which movie or movies it came from, so results can show the movie used.

### Storage and hosting

* No hosted database. The data file ships with the application and is loaded into memory when the application starts.  
* The application is hosted on Render's free tier.

### Application

* Full Stack Application: a back end that holds the Movie Database and runs the 3 operations, and a front end with the enter screen, the 3 tabs, and the animations.  
* The front end asks the back end for: actor autocomplete, the largest finite shortest path, the shortest path between two actors, the shortest cycle for 3 to 6 actors, and the layers around one actor (shortest or best-rated).  
* Each result includes what the animation needs: the answer, plus the links that were explored and rejected.  
* The 3 operations sit behind one module that takes the data and returns answers. The front end and the tests both go through it, so the algorithm inside can change without changing anything else.

### Operations

* The algorithm for each operation is not decided in this spec. AI will assist with choosing and implementing an algorithm within Data Structures & Algorithms for each of the 3 operations in future chats.  
* Tab 1 has the no-input answer for the whole database, plus an optional two-actor search.  
* Tab 2 accepts any 3 to 6 distinct actors and has two outcomes: a cycle, or not possible and why. There is no time limit. The cap of 6 is a limit of the demo, not of the operation.  
* Tab 3 is Six Degrees of Bacon as layers from one actor to everyone, with Kevin Bacon as the default and any actor as input. The best-rated choice relies on the movie rankings.

### Colors

* Green path: part of the answer. Red path: explored and rejected. Fully red result: not possible. The same rule applies on every tab.

## Testing Decisions

Test cases are required. Each operation is tested against a tiny hand-made dataset (around ten actors and a handful of movies) where the right answers can be worked out on paper. The same dataset is used to explain the operations when presenting.

* A good test checks only the answer an operation returns, not how the code gets it. The tests keep working whichever algorithm is chosen later.  
* All tests go through the one module that holds the 3 operations.  
* There is no prior art; this is a new project.  
* The animations are not tested.

The tiny dataset must contain at least: two separate groups of actors with no movie linking them, one movie with three or more actors, and movies with different ratings.

### Test Cases For Each Operation

- Data Filter: A movie rated below 6.1 is left out. A movie with fewer than 1,100 votes is left out. A title that is not a feature film is left out. Crew who are not actors are left out.  
- Largest finite shortest-path: Returns the farthest-apart pair and distance worked out on paper. Ignores pairs in separate groups.  
- Shortest path between two actors: Returns the paper answer. Reports no path for actors in separate groups.  
- Shortest cycle: Finds a cycle that exists, with no actor repeated. Uses the same movie for multiple connections when that is shortest. Reports not possible, with the reason, for actors in separate groups. Works for k \= 3 and for k \= 6\.  
- Six Degrees of Bacon: Returns the right actors in each layer. Leaves out actors who cannot be linked. Shortest and best-rated give different links where the ratings differ.

## Out of Scope

* Choosing the algorithm for each operation. That is decided with AI in future chats.  
* A How it works panel on each tab. The algorithms and their running times are explained by the presenter.  
* Scraping IMDb pages.  
* Full cast lists beyond the principal cast.  
* A hosted database.  
* More than 6 actors on the shortest cycle tab.  
* A time limit on the shortest cycle search.  
* Tests for the animations.  
* User accounts or saved searches.

## Further Notes

* Known assumption: the official IMDb files list only the principal cast of each movie, not every credited actor. Two actors are connected only if both are in the principal cast of the same movie.  
* Still graded: the assignment asks that for each operation we explain how it is done algorithmically and its running time. This is not in the site, so it has to be covered when presenting or in writing.  
* Running time: the assignment does not require the shortest cycle algorithm to have polynomial running time. It does not state a running time requirement for the other operations.  
* Render free tier: the site spins down after 15 minutes without traffic and takes about a minute to wake up, so open it a couple of minutes before presenting. The free web service has 512 MB of RAM, which the filtered data has to fit in.  
* Optional: a separate page which explains the project, reached from the top right, built only if need be.  
* AI RULES: Must Create a DECISIONS.MD and chat\_log.md to store important decisions made and why for algorithmic design as well as chat\_log which updates after every request (stored in chronological order) to detail the building process of this application.

## Sources

* [IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets)  
* [Render: Deploy for Free](https://render.com/docs/free)

### 