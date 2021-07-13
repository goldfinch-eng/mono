import React from "react"
import ReactDOM from "react-dom"
import "./layout/index.scss"
import {App} from "./App"
import * as serviceWorker from "./serviceWorker"
import "focus-within-polyfill"
import * as Sentry from "@sentry/react"
import {BrowserTracing as BrowserTracingIntegration} from "@sentry/tracing"
import {CaptureConsole as CaptureConsoleIntegration} from "@sentry/integrations"

function configureSentry() {
  const dsn =
    process.env.REACT_APP_DEPLOY_CONTEXT === "deploy-preview"
      ? process.env.REACT_APP_SENTRY_DSN_DEPLOY_PREVIEW
      : process.env.REACT_APP_SENTRY_DSN
  if (dsn) {
    const release = process.env.REACT_APP_COMMIT_ID

    Sentry.init({
      dsn,
      integrations: [new BrowserTracingIntegration(), new CaptureConsoleIntegration()],
      release,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.25 : 1.0,
    })

    if (!release) {
      if (process.env.NODE_ENV !== "development") {
        console.error("Failed to obtain Sentry `release`.")
      }
    }
  } else {
    if (process.env.NODE_ENV !== "development") {
      console.error("Failed to obtain Sentry `dsn`.")
    }
  }
}

configureSentry()

ReactDOM.render(<App />, document.getElementById("root"))

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister()
