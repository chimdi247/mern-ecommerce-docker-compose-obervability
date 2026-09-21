// Spike test: a sudden, massive burst of traffic (well beyond
// load-test.js's steady-state level) followed by an equally sudden
// drop -- simulates a flash sale / a product going viral -- and
// checks the app survives the burst and recovers cleanly once it
// passes. See test/README.md for scope.
//
// Run via ../spike-test.sh, or directly:
//   k6 run --env BASE_URL=http://localhost:5000 spike-test.js
import { sleep } from 'k6';
import { browseStorefront } from './helpers.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // normal baseline
        { duration: '10s', target: 400 }, // sudden spike
        { duration: '1m', target: 400 }, // hold at peak
        { duration: '10s', target: 10 }, // sudden drop
        { duration: '1m', target: 10 }, // does it recover?
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.5'],
  },
};

export default function () {
  browseStorefront();
  sleep(0.1);
}
