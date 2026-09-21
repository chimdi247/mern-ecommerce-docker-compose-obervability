# MERN Ecommerce

An ecommerce storefront + admin app: a Node/Express (TypeScript) REST
API backend with MongoDB, and a React (Vite) frontend. Customers
browse and buy products; admins manage products, categories, promos,
banners, and orders. Authentication is delegated to Clerk; payments go
through Razorpay; product images go through Cloudinary.

## Running everything with Docker Compose

The whole stack -- MongoDB, the Node backend, the React frontend, and
a full observability stack (Prometheus, Grafana, Loki, Tempo,
OpenTelemetry Collector, cAdvisor, node-exporter) -- starts with:

```bash
docker compose up --build
```

A ready-to-use `.env` is already included, so the stack itself comes
up with no setup. **Signing into the app is the one thing that needs a
manual step first** -- read [docker/README.md](docker/README.md)
before you expect to log in: authentication is entirely delegated to
Clerk (a hosted identity provider), so `admin@example.com` /
`password123` can't work as a literal local login the way it might in
an app with its own password table -- there's a short, real path to
get an admin login working (free Clerk API keys + one sign-up), just
not a fully-automated one.

Everything else -- the database schema/indexes, the observability
stack, the dashboard -- is fully automatic. See
[docker/README.md](docker/README.md) for the database init scripts.

Once everything is healthy:

| What | URL | Notes |
|---|---|---|
| App (frontend) | http://localhost:3000 | Needs real Clerk keys in `.env` to sign in -- see docker/README.md |
| Backend API | http://localhost:5000 | -- |
| Grafana | http://localhost:3001 | `admin` / `admin` |
| Prometheus | http://localhost:9091 | -- |

See [observability/README.md](observability/README.md) for how
telemetry flows from the app to Grafana, what the provisioned
dashboard/alerts cover, and a couple of caveats. See
[test/README.md](test/README.md) for load/stress/spike test scripts
you can run against the stack once it's up.

Tear down with `docker compose down`, or `docker compose down -v` to
also wipe the database/metrics volumes (needed if you edit the DB init
scripts, since they only run against a fresh volume).

## Repository Layout

```text
server/          Node/Express REST API (TypeScript, MongoDB, Clerk auth, Razorpay)
client/          React (Vite) frontend
docker/          Root docker-compose.yml's MongoDB init scripts + admin-promotion helper
observability/   Root docker-compose.yml's Prometheus/Loki/Tempo/Grafana/otel-collector config
test/            k6 load/stress/spike test scripts
```

## Manual / local development

### Backend

Prerequisite: Node.js 20+, MongoDB running locally.

```bash
cd server
npm install
npm run dev
```

Reads configuration from `server/.env` (`MONGO_URI` defaults to
`mongodb://localhost:27017/ecommerce` if unset). The API listens on
`http://localhost:5000`.

### Frontend

```bash
cd client
npm install
npm run dev
```

The frontend is available at `http://localhost:5173` (Vite's default
dev port) and talks to `VITE_BACKEND_URL` (defaults to
`http://localhost:5000` if unset).

## Tech Stack

| Area | Main tools |
|---|---|
| Backend | Node.js, Express, TypeScript, Mongoose, Clerk, Razorpay, Cloudinary |
| Frontend | React, Vite, TypeScript |
| Database | MongoDB |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Tempo |
| Infrastructure | Docker Compose |
