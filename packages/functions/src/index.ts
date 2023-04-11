import * as Sentry from "@sentry/serverless"
import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import {CaptureConsole} from "@sentry/integrations"
import {findEnvLocal} from "@goldfinch-eng/utils"
import {getConfig} from "./db"
import dotenv from "dotenv"

dotenv.config({path: findEnvLocal()})

const _config = getConfig(functions)
Sentry.GCPFunction.init({
  dsn: _config.sentry.dsn,
  integrations: [
    new CaptureConsole({
      levels: ["log", "info", "warn", "error"],
    }),
  ],
  release: _config.sentry.release,
  environment: _config.sentry.environment,
  tracesSampleRate: _config.sentry.environment === "production" ? 0.25 : 1.0,
})

admin.initializeApp()

export * from "./handlers/circulatingSupply"
export * from "./handlers/poolTokenMetadata"
export * from "./handlers/stakingRewardsTokenMetadata"
export * from "./handlers/kycStatus"
export * from "./handlers/signAgreement"
export * from "./handlers/personaCallback"
export * from "./handlers/destroyUser"
export * from "./handlers/setUserKycData"
export * from "./handlers/linkUserToUid"
export * from "./handlers/slack"
export * from "./handlers/parallelmarkets/parallelMarketsDemoWebhookProcessor"
export * from "./handlers/registerKyc"
