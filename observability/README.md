# observability/

Config and provisioning for the monitoring stack in `docker-compose.yml`:
OpenTelemetry Collector, Prometheus, Grafana, Loki, Promtail, and Tempo.

## How telemetry flows

```text
backend (Node/Express) -- OpenTelemetry auto-instrumentation ---> traces (OTLP) --> otel-collector --> Tempo
  (node --require ./dist/otel/otel-bootstrap.js, zero code       metrics ---------------------------> :9464/metrics --> scraped by Prometheus directly
   changes beyond a few business counters -- see below)

db (mongo) / backend / frontend (containers) --> cAdvisor ------------------------------------------> scraped by Prometheus
host --------------------------------------------> node-exporter --------------------------------------> scraped by Prometheus

every container's stdout ------------------------> Promtail (via Docker socket) -----------------------> Loki

Prometheus, Loki, Tempo  ---- all three added as Grafana datasources, cross-linked
                              (trace -> logs, trace -> service graph, log -> trace)
```

- **Traces & auto-instrumented metrics**: `server/src/otel/otel-bootstrap.ts`
  (compiled to `dist/otel/otel-bootstrap.js`, loaded via `node --require`
  before `dist/server.js` -- see `server/Dockerfile`) is the zero-code
  auto-instrumentation entry point: `getNodeAutoInstrumentations()` patches
  Express, the `http`/`https` modules, and Mongoose automatically at
  module-load time, with no source changes to the routes/models themselves.
  Traces export via OTLP to `otel-collector`, which forwards them to Tempo.
  Metrics are exposed directly by the backend's own Prometheus exporter at
  `:9464/metrics` (see below for why), scraped by Prometheus directly.
  **This whole file is wrapped in a `try/catch`** -- if OpenTelemetry fails
  to initialize for any reason, the app still starts normally; telemetry
  is important but must never be able to break the actual ecommerce app.

- **Business metrics**: on top of the auto-instrumented technical metrics,
  `server/src/otel/business-metrics.ts` defines a handful of ecommerce
  counters (`ecommerce_orders_created_total`, `ecommerce_orders_paid_total`,
  `ecommerce_revenue_total`, `ecommerce_payment_signature_invalid_total`,
  `ecommerce_checkout_failed_total`), incremented at the relevant points in
  `server/src/routes/customer/checkout.routes.ts`. These use the global
  `@opentelemetry/api`, so they're safe no-ops if the SDK isn't running.

- **Why the backend exposes its own `/metrics` instead of going through the
  collector**: this gives a genuine `up{job="ecommerce-backend"}` signal in
  Prometheus (whether the backend process itself is reachable), rather than
  only ever knowing whether the collector is up. Traces still go through
  the collector, since there's no equivalent "scrape traces" concept.

- **Container/node metrics**: `cadvisor` (container CPU/memory/network) and
  `node-exporter` (host CPU/memory/disk), scraped directly.

- **Logs**: `promtail` uses Docker service discovery (`docker_sd_configs`,
  via a read-only mount of the Docker socket) to tail **every** container's
  stdout/stderr into Loki -- backend (morgan HTTP logs), frontend (nginx's
  structured JSON access log, see `client/nginx.conf`), and every
  infra container.

### A metric-name caveat worth knowing

The HTTP request metric names used in the dashboard/alerts below
(`http_server_duration_milliseconds_count`/`_bucket`) match the
`@opentelemetry/instrumentation-http` version pinned in `package.json` at
the time this was put together. OpenTelemetry's JS semantic conventions for
HTTP metrics have changed across versions (older versions emit
`http.server.duration` in milliseconds; some newer/experimental versions
have moved to `http.server.request.duration` in seconds). **If the "HTTP
Traffic & Latency" panels or alerts come up empty**, open Prometheus
(http://localhost:9091) -> Graph, and search for `http_server` to see what
actually got scraped, then adjust the metric name in
`observability/grafana/provisioning/dashboards/ecommerce-overview.json`
accordingly (a find-and-replace). The business-metric and
container/node panels aren't affected by this -- those names are exact,
since this repo's own code defines them.

### Why the frontend has no OpenTelemetry SDK

The backend gets true zero-code auto-instrumentation via `--require`
because it's a long-running Node process. The React frontend is a Vite
static SPA with no server-side runtime -- bundling the OpenTelemetry Web
SDK (`@opentelemetry/sdk-trace-web` + `auto-instrumentations-web`) directly
into the build was intentionally left out here too: it couldn't be verified
without actually running the build, and a broken frontend build would be
far worse than skipping browser-side tracing. (Vite's esbuild/Rollup
pipeline generally has fewer package-compatibility issues than
webpack 5/CRA for this, so it's a more realistic follow-up here than it
was for a CRA app -- just not something shipped un-verified.) Frontend
request activity is visible through its structured nginx access logs in
Loki, and cAdvisor covers its container-level CPU/memory like every other
container.

## Grafana

- URL: http://localhost:3001 (or `${GRAFANA_PORT}`)
- Login: `admin` / `admin` (`GF_ADMIN_USER` / `GF_ADMIN_PASSWORD` in `.env`)
- Datasources (Prometheus, Loki, Tempo) and the dashboard below are
  provisioned automatically on first boot from
  `observability/grafana/provisioning/`.

### Dashboard

"Ecommerce - Service Overview" (`ecommerce-overview.json`), in the
"Ecommerce" folder, 28 panels across five rows:

- **Service Health & SLOs**: uptime, availability SLI, error rate, request
  rate, P95 latency, and a table of every scrape target's up/down status
- **HTTP Traffic & Latency (SLIs)**: request rate by status code, p50/p95/
  p99 latency, error rate over time, busiest routes
- **Ecommerce Business Metrics**: orders created/paid (1h), checkout
  conversion %, revenue (1h), invalid payment signatures, orders
  created-vs-paid rate, checkout failures by reason, revenue rate,
  invalid-signature attempt rate
- **Container Resource Utilization**: CPU % and memory per container
- **Node Resource Utilization**: host CPU % and memory %

### Alerting

Seven Grafana-managed alert rules
(`observability/grafana/provisioning/alerting/rules.yaml`), across two
groups:

**Resource utilization** (evaluated every minute, firing after 5m sustained):
- Container CPU > 70%
- Container memory > 70% **of its configured limit**
- Node CPU > 70%
- Node memory > 70%

**Ecommerce business logic**:
- Checkout failure rate > 20% over 15m (out-of-stock/unavailable-product/
  empty-cart failures relative to successful checkout starts)
- Payment signature verification failures spike (>5 in 15m -- a possible
  Razorpay key mismatch or forged-payment attempt; `severity: critical`)
- Orders being created but none completing payment in 30m (correlates
  checkout starts with zero completions, so it only fires when checkouts
  are actually being attempted -- not during genuinely idle periods;
  `severity: critical`)

All route to a single email contact point (`ops-email`), sent to
`ALERT_EMAIL_TO` in `.env` -- actual delivery needs real SMTP credentials,
which this app doesn't currently have any config for (there's no email
sending in this codebase to reuse settings from, unlike the other example
projects) -- see `.env`'s comments for where to add them if you want alert
emails to actually deliver.

**Why "% of limit" for container memory**: `container_spec_memory_limit_bytes`
(from cAdvisor) is a huge sentinel value for containers with no memory cap,
which would make a raw usage-based percentage meaningless. So
`docker-compose.yml` sets `deploy.resources.limits.memory` on every
application/data-store service (honored by plain `docker compose up` in
Compose v2, not just Swarm) specifically so this alert has a real
denominator.

## Known platform caveats

- **cAdvisor** runs `privileged: true` with the standard host mounts for the
  most reliable cross-platform metrics collection; on Docker Desktop
  (macOS/Windows) some disk-level metrics may still be unavailable since
  it's running inside a Linux VM, but container CPU/memory metrics work
  normally.
- **node-exporter** is run with bind-mounted `/proc`, `/sys`, `/` (not
  `network_mode: host`, which doesn't work on Docker Desktop) so it starts
  consistently everywhere; on Docker Desktop this reports the VM's
  resources, not literally the physical host's.
- Tempo's `metrics_generator` pushes span-derived RED metrics to Prometheus
  via `remote_write` (needs `--web.enable-remote-write-receiver`, already set
  on the `prometheus` service) -- this is a bonus signal, not required for
  the dashboard/alerts above, which all use the backend's direct
  `/metrics`/cAdvisor/node-exporter.
