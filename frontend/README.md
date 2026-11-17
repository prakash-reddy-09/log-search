# Trace — React Log Search UI

A Vite + React frontend for the existing Spring Boot log-search API.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- Your Spring Boot API running on `http://localhost:8080`

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).

Vite proxies `/api/*` and `/swagger-ui.html` to `http://localhost:8080`, so the browser can call your existing backend without changing the API.

## Build

```bash
npm run build
npm run preview
```

The production build is created in `dist/`.

## API contract used

- `GET /api/logs` → JSON array of `{ id, sizeBytes }`
- `POST /api/logs` → multipart form field named `file`
- `GET /api/logs/{id}/search?q=...&engine=cpp|java&limit=200`
  - optional: `level`, `from`, `to`
  - expected response: `{ totalMatches, returned, tookMs, engine, results: [{ lineNumber, text }] }`

If your backend runs somewhere other than `localhost:8080`, edit `vite.config.js` or set `VITE_API_BASE_URL` in a `.env` file. If you use a separate frontend origin in production, configure CORS on the Spring Boot API.

## Notes

- The UI keeps the same API routes and query parameter names as your original HTML.
- Search highlighting escapes query terms before building the regular expression.
- The frontend does not implement authentication; add it if your API requires it.
