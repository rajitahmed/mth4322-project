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

## Test

```sh
npm test           # Vitest
npm run typecheck
```

The tiny dataset in `data/tiny` has its paper answers in `data/tiny/ANSWERS.md`.

## API

- `GET /api/actors?q=<text>&limit=<1-50>`: Actors with a word in their name starting with `q`, as `[{ id, name, birthYear }]`.
