// Load test: steady, realistic traffic to validate the app performs
// well under expected normal usage -- the baseline "does this behave
// correctly under normal load" check, run before stress-test.js or
// spike-test.js. See test/README.md for scope/limitations (public
// storefront endpoints only, no authenticated flows -- Clerk).
//
// Run via ../load-test.sh, or directly:
//   k6 run --env BASE_URL=http://localhost:5000 load-test.js
import { sleep } from 'k6';
import { browseStorefront } from './helpers.js';

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 700 }, // ramp up
        { duration: '5m', target: 700 }, // hold steady
        { duration: '30s', target: 100 }, // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // fewer than 1% failed requests
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
};

export default function () {
  browseStorefront();
  sleep(1);
}
