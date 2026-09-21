// Custom business (ecommerce) metrics, on top of the auto-instrumented
// technical metrics (HTTP/Mongoose spans+metrics come for free from
// `@opentelemetry/auto-instrumentations-node/register` -- see
// server/Dockerfile's CMD and observability/README.md).
//
// These use the global OpenTelemetry API, so they're safe no-ops if
// the SDK isn't initialized (e.g. running `npm run dev` outside
// Docker without --require) -- no conditional wiring needed at each
// call site.
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("ecommerce-business-metrics");

export const ordersCreatedCounter = meter.createCounter(
  "ecommerce_orders_created_total",
  { description: "Orders created (checkout session started)" },
);

export const ordersPaidCounter = meter.createCounter(
  "ecommerce_orders_paid_total",
  { description: "Orders successfully paid for" },
);

export const revenueCounter = meter.createCounter("ecommerce_revenue_total", {
  description: "Revenue from paid orders, in the smallest currency unit (paise)",
});

export const paymentSignatureInvalidCounter = meter.createCounter(
  "ecommerce_payment_signature_invalid_total",
  { description: "Checkout confirmations rejected for an invalid Razorpay signature (possible fraud/integration issue)" },
);

export const checkoutFailedCounter = meter.createCounter(
  "ecommerce_checkout_failed_total",
  { description: "Checkout session creation failures (out of stock, invalid promo, etc.)" },
);
