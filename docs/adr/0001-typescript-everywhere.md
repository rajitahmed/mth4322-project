# TypeScript everywhere, with the graph in typed arrays

We use TypeScript on Node (Fastify) for the back end, plain TypeScript with a canvas and Vite for the front end, Vitest for tests, and Node for the offline data script. The actor–movie graph is held in typed arrays in compressed sparse row (CSR) form.

We chose this for speed and memory. iFUB runs dozens of full searches at server startup and the Cycle search (IDA*) is exponential, so pure Python's 10–50× slowdown would turn cycle answers from seconds into minutes. Typed arrays keep the graph well inside Render's 512 MB. One language also means shared result types between server and animations, and one test runner.

## Considered Options

- **Python (FastAPI) back end:** familiar, but graph search is 10–50× slower.
- **Python with NumPy/SciPy:** fast BFS, but IDA*'s backtracking can't be vectorized.
