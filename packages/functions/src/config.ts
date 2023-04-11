import * as FirebaseFunctions from "firebase-functions"
import {isPlainObject, isString, isStringOrUndefined} from "@goldfinch-eng/utils"

export type FirebaseConfig = {
  sentry: {
    dsn: string
    release: string
    environment: "development" | "test" | "production"
  }
  kyc: {
    // eslint-disable-next-line camelcase
    allowed_origins: string
  }
  persona: {
    // eslint-disable-next-line camelcase
    allowed_ips: string
    secret?: string
  }
  slack: {
    token: string
  }
  parallelmarkets: {
    base_url: string
    api_key: string
    client_id: string
    client_secret: string
    webhook_key: string
    redirect_uri: string
    env: "production" | "test" | "development"
  }
}

let _configForTest: FirebaseConfig = {
  kyc: {allowed_origins: "http://localhost"},
  persona: {allowed_ips: ""},
  sentry: {
    dsn: "https://8c1adf3a336a4487b14ae1af080c26d1@o915675.ingest.sentry.io/5857894",
    release: process.env.COMMIT_ID_FOR_TEST || "",
    environment: "test",
  },
  slack: {
    token: process.env.SLACK_TOKEN || "",
  },
  parallelmarkets: {
    base_url: "https://demo-api.parallelmarkets.com/v1",
    api_key: process.env.PM_DEMO_API_KEY || "",
    client_id: process.env.PM_CLIENT_ID || "",
    client_secret: process.env.PM_CLIENT_SECRET || "",
    webhook_key: process.env.PM_WEBHOOK_KEY || "",
    redirect_uri: process.env.PM_REDIRECT_URI || "",
    env: "test",
  },
}

type ObjectVerifier<Type> = {
  [Key in keyof Type]: Type[Key] extends object
    ? ObjectVerifier<Type[Key]>
    : Type[Key] extends unknown[]
    ? ObjectVerifier<Type[Key]>
    : (arg: Type[Key]) => boolean
}

const firebaseConfigVerifier: ObjectVerifier<Required<FirebaseConfig>> = {
  sentry: {
    dsn: isString,
    release: isString,
    environment: (arg: string) => ["development", "test", "production"].includes(arg),
  },
  kyc: {
    allowed_origins: isString,
  },
  persona: {
    allowed_ips: isString,
    secret: isStringOrUndefined,
  },
  slack: {
    token: isString,
  },
  parallelmarkets: {
    base_url: isString,
    api_key: isString,
    client_id: isString,
    client_secret: isString,
    webhook_key: isString,
    redirect_uri: isString,
    env: (arg: string) => ["development", "test", "production"].includes(arg),
  },
}

/**
 * Type guard for the FirebaseConfig type.
 * @param {unknown} obj The thing whose type to inspect.
 * @return {boolean} Whether the thing is of type FirebaseConfig.
 */
function isFirebaseConfig(obj: unknown): obj is FirebaseConfig {
  if (!isPlainObject(obj)) return false

  for (const [namespace, fields] of Object.entries(firebaseConfigVerifier)) {
    const namespacedObject = obj[namespace]
    if (!isPlainObject(namespacedObject)) return false

    for (const [property, validator] of Object.entries(fields)) {
      if (!validator(namespacedObject[property] as any)) {
        return false
      }
    }
  }

  return true
}

/**
 * Get the firebase config (test aware)
 * @param {any} functions The firebase functions library (ignored in test)
 * @return {FirebaseConfig} The config object
 */
export function getConfig(functions: typeof FirebaseFunctions): FirebaseConfig {
  // When running using the Firebase emulator (e.g. as `yarn ci_test` does via `yarn firebase emulators:exec`),
  // we observed a transient / bootstrapping phase in which this function is called (because it is invoked at
  // the root level of `index.ts`, which is a consequence of following the Sentry docs about how to configure
  // Sentry for use with Google Cloud functions and of using the Firebase config to provide the necessary values)
  // in which env variables such as `process.env.NODE_ENV` are undefined. That poses a problem for running our
  // tests using the emulator, because we want to condition on `process.env.NODE_ENV === "test"` to be able to
  // test the behavior that the Firebase config controls. As a workaround for this issue, we can detect
  // whether we're in this bootstrapping phase, and use the test config for it as well as for when
  // `process.env.NODE_ENV === "test"`. `process.env.NODE_ENV` becomes `"test"` immediately after this
  // bootstrapping phase, via the `yarn test` command passed as an argument to `yarn firebase emulators:exec`.
  const isBootstrappingEmulator =
    process.env.FUNCTIONS_EMULATOR === "true" && // Cf. https://stackoverflow.com/a/60963496
    process.env.NODE_ENV === undefined &&
    // We expect the emulator never to be used with the prod project's functions, so we can
    // include the following extra condition to prevent `isBootstrappingEmulator` ever enabling use of the
    // test config with the prod project.
    process.env.GCLOUD_PROJECT === "goldfinch-frontends-dev"

  const isTesting = process.env.NODE_ENV === "test"
  const result = isBootstrappingEmulator || isTesting ? _configForTest : functions.config()
  if (isFirebaseConfig(result)) {
    return result
  } else {
    throw new Error(`Firebase config failed type guard. result:${JSON.stringify(result)}`)
  }
}

/**
 * Override the config to use for tests
 * @param {Partial<FirebaseConfig>} config The config to override with
 */
export function setTestConfig(config: Partial<FirebaseConfig>): void {
  _configForTest = {
    ..._configForTest,
    ...config,
  }
}
