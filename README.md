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

`DATA_DIR` picks the folder with `movies.csv`, `actors.csv` and `credits.csv` (default: `data/imdb`, the real data; set it to `data/tiny` for a server that starts at once). `PORT` sets the port.

## Deploy (Render)

The site runs as a free Render web service, described in `render.yaml`. To set it up: in the Render Dashboard, choose **New → Blueprint** and pick this repo. Render then runs `npm ci && npm run build` and `npm start`. It sets `PORT`, and the real data is already in the repo (ADR 0002). Each push to `main` deploys again.

**The free service sleeps after 15 minutes without traffic, and takes about 1 minute to wake** ([Render docs](https://render.com/docs/free)). Waking also includes the server's own startup (~8 s locally, longer on Render's smaller CPU). **Open the site a few minutes before presenting.**

The deploy log prints the startup time and peak memory (`Started in … ms, memory … MB (peak … MB)`). The peak must stay under 512 MB: `render.yaml` caps the V8 heap at 200 MB for that (ADR 0003).

## Data

The app reads three CSV files. `data/tiny` holds a small hand-made dataset for tests. `data/imdb` holds the real data (29,705 Movies, 119,458 Actors, 271,435 credits, about 10 MB), committed with the app:

```sh
npm run build
npm start   # ready after ~8 s on Node 26; peak memory 480–525 MB uncapped (ADR 0003, DECISIONS D26)
```

The real data comes from the [IMDb non-commercial datasets](https://developer.imdb.com/non-commercial-datasets), filtered by an offline script that you run on your own computer (not on the server). Run it again only to refresh the data:

```sh
npm run data       # writes data/imdb/{movies,actors,credits}.csv
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
