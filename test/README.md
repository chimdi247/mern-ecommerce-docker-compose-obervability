# test/

Shell scripts for load, stress, and spike testing the running app,
using [k6](https://k6.io/). Run these **after** `docker compose up` is
healthy, from the project root or from inside this folder.

```bash
./test/load-test.sh      # steady realistic traffic
./test/stress-test.sh    # progressively increasing load past normal capacity
./test/spike-test.sh     # sudden burst, then sudden drop
```

Each script targets `http://localhost:${BACKEND_PORT:-5000}` by default
(override with `BASE_URL=... ./test/load-test.sh`). If you have `k6`
installed locally it's used directly; otherwise the scripts fall back
to running it via `docker run grafana/k6` automatically -- no local
install required, just Docker.

While a test runs, watch the **"Ecommerce - Service Overview"**
dashboard in Grafana (http://localhost:3001) -- request rate, error
rate, latency percentiles, and container/node CPU & memory all update
live. See `observability/README.md`.

## Scope: public storefront endpoints only

This app's authentication is entirely delegated to Clerk (see
`docker/README.md`), which requires a real browser sign-in flow to get
a session token -- there's no username/password endpoint a script can
call directly to obtain one. So these scripts exercise the app's
**public, unauthenticated endpoints** only:

- `GET /health`
- `GET /customer/home`
- `GET /customer/categories`
- `GET /customer/products`
- `GET /customer/products/:id` (if the catalog has at least one
  product -- it won't on a fresh install until an admin adds one)

This is also, realistically, the traffic pattern that matters most for
a storefront's load characteristics -- most visitors browse far more
than they check out. Authenticated flows (cart, checkout, admin) aren't
covered by these scripts.

## What each scenario does

| Script | Pattern | What it's for |
|---|---|---|
| `load-test.js` | Ramp to 20 VUs, hold 2m, ramp down | Baseline: does the app behave correctly under expected normal traffic? Strict thresholds (p95 < 800ms, p99 < 1.5s, <1% failures) -- meant to pass. |
| `stress-test.js` | Ramp 50 -> 150 -> 300 -> 500 VUs over ~8m, then back to 0 | Where does the app start degrading? Thresholds are deliberately loose so the run completes; watch error rate/latency climb in Grafana, and whether the app recovers once load drops back to 0. |
| `spike-test.js` | 10 VUs -> sudden jump to 400 VUs in 10s -> hold -> sudden drop back to 10 | Does the app survive a sudden burst (flash sale, a product going viral) and recover cleanly afterward? |

`test/scripts/helpers.js` has the shared browsing logic (home page,
categories, product list, and a product-detail lookup if any products
exist); each scenario file just wraps it in different k6 load stages.

## Customizing

- `BASE_URL` -- backend base URL (default `http://localhost:5000`)

Any extra arguments are passed straight through to `k6 run`, e.g. to
write a JSON summary:

```bash
./test/load-test.sh --summary-export=load-test-results.json
```
