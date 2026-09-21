// Stress test: progressively pushes far beyond normal expected load
// to find where the app starts degrading or failing -- watch
// Grafana's "Ecommerce - Service Overview" dashboard (error rate,
// latency percentiles, container/node CPU & memory) while this runs.
// Thresholds are deliberately loose so the run completes and you can
// see the full degradation curve. See test/README.md for scope.
//
// Run via ../stress-test.sh, or directly:
//   k6 run --env BASE_URL=http://localhost:5000 stress-test.js
import { sleep } from 'k6';
import { browseStorefront } from './helpers.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 }, // recovery
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.5'],
  },
};

export default function () {
  browseStorefront();
  sleep(0.2);
}
