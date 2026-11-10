# Movie Statistics

Statistics over the Actors of well-rated IMDb feature films (rating ≥ 6.1 from ≥ 1,100 votes).
Spec: `brief.md`. Design: `design.md`. Algorithms: `DECISIONS.md`.

## Run

```sh
npm install
npm run build   # build the web app into dist/web
npm start       # server on http://localhost:3000, serving the API and dist/web
```

For development, run `npm run dev:server` and `npm run dev:web` side by side, then open the Vite URL (it forwards `/api` to the server).

`DATA_DIR` picks the folder with `movies.csv`, `actors.csv` and `credits.csv` (default: `data/tiny`). `PORT` sets the port.

## Data

The app reads three CSV files. `data/tiny` holds a small hand-made dataset for tests. The real data comes from the [IMDb non-commercial datasets](https://developer.imdb.com/non-commercial-datasets), filtered by an offline script that you run on your own computer (not on the server):

```sh
npm run data       # writes data/imdb/{movies,actors,credits}.csv
DATA_DIR=data/imdb npm start
```

The script downloads `title.ratings`, `title.basics`, `title.principals` and `name.basics` (`.tsv.gz`, about 1.3 GB in total) into `data/imdb-raw/`, which git ignores. A file already there is reused, not downloaded again; delete it to fetch a newer copy. It keeps feature films (title type `movie`) rated at least 6.1 from at least 1,100 votes, and the actors and actresses in their principal cast (DECISIONS D15).

## Test

```sh
npm test           # Vitest
npm run typecheck
```

The tiny dataset in `data/tiny` has its paper answers in `data/tiny/ANSWERS.md`.

## API

- `GET /api/actors?q=<text>&limit=<1-50>`: Actors with a word in their name starting with `q`, as `[{ id, name, birthYear }]`.
