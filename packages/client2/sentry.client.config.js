// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn:
    SENTRY_DSN ||
    "https://753b95473ec54f83a8c0fcee242d6aca@o915675.ingest.sentry.io/6534483",
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing({
      // The is done intentionally to prevent Sentry from placing a `baggage` header when communicating with local subgraph. That header results in a CORS rejection, very annoying
      tracingOrigins: process.env.NODE_ENV === "development" ? ["bogus"] : [],
    }),
  ],
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
