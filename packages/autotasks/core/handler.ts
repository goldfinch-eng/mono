import {HandlerParams} from "../types"
import * as Sentry from "@sentry/node"

// Importing @sentry/tracing patches the global hub for tracing to work.
import "@sentry/tracing"

Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
})

export async function handler(arg: HandlerParams, callback: (arg: HandlerParams) => any) {
  const transaction = Sentry.startTransaction({
    op: "test",
    name: "My First Test Transaction",
  })

  let result = undefined
  try {
    result = callback(arg)
  } catch (e) {
    Sentry.captureException(e)
  }

  transaction.finish()

  return result
}
