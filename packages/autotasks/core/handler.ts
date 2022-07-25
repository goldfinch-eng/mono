import * as Sentry from "@sentry/node"
import {HandlerParams} from "../types"

import "@sentry/tracing"

if (process.env.NODE_ENV !== "test") {
  Sentry.init({
    // https://sentry.io/organizations/goldfinch/projects/autotasks/?project=6592255
    dsn: "https://a544fc1378cb4f24a50cfe9bce55f070@o915675.ingest.sentry.io/6592255",
    tracesSampleRate: 1.0,
  })
}

export default function handler(
  name: string,
  callback: (arg: HandlerParams) => Promise<any>
): (arg: HandlerParams) => Promise<any> {
  // autotasks run as lambdas behind the scenes, so we init sentry once (above/global)
  // and then create a new transaction every invocation.
  //
  // https://docs.openzeppelin.com/defender/autotasks#whats-in-an-autotask
  const context = {
    name,
  }

  return async (arg: HandlerParams) => {
    const transaction = Sentry.startTransaction(context)

    try {
      return await callback(arg)
    } catch (e) {
      Sentry.captureException(e)
      throw e
    } finally {
      transaction.finish()
    }
  }
}
