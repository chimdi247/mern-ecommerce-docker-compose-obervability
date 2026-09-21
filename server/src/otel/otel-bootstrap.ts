// OpenTelemetry bootstrap, loaded before any application code via
// `node --require ./dist/otel/otel-bootstrap.js dist/server.js` (see
// Dockerfile). This is the zero-code auto-instrumentation entry point
// for the backend: it patches Express/HTTP/Mongoose/etc. automatically
// via getNodeAutoInstrumentations(), and additionally runs a
// dedicated Prometheus exporter (:9464/metrics) so Prometheus can
// scrape the backend directly -- both the auto-instrumented technical
// metrics and the custom business counters in
// src/otel/business-metrics.ts end up there. Traces go via OTLP to
// the otel-collector -> Tempo (see observability/README.md).
//
// Everything here is wrapped in try/catch: telemetry is important but
// must never be able to prevent the actual app (dist/server.js,
// required right after this file) from starting. If OpenTelemetry
// fails to initialize for any reason, we log a warning and move on.
try {
  const { NodeSDK } = require("@opentelemetry/sdk-node");
  const {
    getNodeAutoInstrumentations,
  } = require("@opentelemetry/auto-instrumentations-node");
  const {
    OTLPTraceExporter,
  } = require("@opentelemetry/exporter-trace-otlp-proto");
  const { PrometheusExporter } = require("@opentelemetry/exporter-prometheus");

  // service.name / other resource attributes come entirely from the
  // standard OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES environment
  // variables (set in docker-compose.yml) -- every OTel SDK reads
  // these automatically, regardless of SDK version, so there's no
  // need to (and no version-specific API to get wrong by trying to)
  // pass them in code here.
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PrometheusExporter({
      host: "0.0.0.0",
      port: Number(process.env.OTEL_PROMETHEUS_PORT || 9464),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      .shutdown()
      .catch((err: unknown) => console.error("Error shutting down OpenTelemetry", err))
      .finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("OpenTelemetry auto-instrumentation started");
} catch (error) {
  // Never let telemetry setup break the app.
  console.warn("OpenTelemetry failed to initialize, continuing without it:", error);
}
