import * as admin from "firebase-admin"
import * as FirebaseFunctions from "firebase-functions"
import {isPlainObject, isString, isStringOrUndefined} from "@goldfinch-eng/utils"
import firestore = admin.firestore

let _firestoreForTest: firestore.Firestore
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
}

/**
 * Get the users collection given a reference to the firestore
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getUsers(): firestore.CollectionReference<firestore.DocumentData> {
  return getCollection("users")
}

/**
 * Get the destroyed users collection given a reference to the firestore
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getDestroyedUsers(): firestore.CollectionReference<firestore.DocumentData> {
  return getCollection("destroyedUsers")
}

/**
 * Get the agreements collection given a reference to the firestore
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getAgreements(): firestore.CollectionReference<firestore.DocumentData> {
  return getCollection("agreements")
}

/**
 * Generic function to get any collection given a reference to the name and the firestore (test aware)
 * @param {string} collection The collection name
 * @param {firestore.Firestore} firestore The firestore to get the collection from (ignored for tests)
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
const getCollection = (collection: string): firestore.CollectionReference<firestore.DocumentData> => {
  let collectionPrefix = ""

  if (process.env.NODE_ENV === "test") {
    collectionPrefix = "test_"
  }
  const collectionName = `${collectionPrefix}${collection}`
  return getDb().collection(collectionName)
}

/**
 * Get the database (test aware)
 * @return {firestore.Firestore} The databse for the current env
 */
function getDb(): firestore.Firestore {
  if (process.env.NODE_ENV === "test") {
    return _firestoreForTest
  } else {
    return firestore()
  }
}

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
}
/**
 * Type guard for the FirebaseConfig type.
 * @param {unknown} obj The thing whose type to inspect.
 * @return {boolean} Whether the thing is of type FirebaseConfig.
 */
function isFirebaseConfig(obj: unknown): obj is FirebaseConfig {
  return (
    isPlainObject(obj) &&
    isPlainObject(obj.sentry) &&
    isString(obj.sentry.dsn) &&
    isString(obj.sentry.release) &&
    (obj.sentry.environment === "development" ||
      obj.sentry.environment === "test" ||
      obj.sentry.environment === "production") &&
    isPlainObject(obj.kyc) &&
    isString(obj.kyc.allowed_origins) &&
    isPlainObject(obj.persona) &&
    isString(obj.persona.allowed_ips) &&
    isStringOrUndefined(obj.persona.secret)
  )
}

/**
 * Get the firebase config (test aware)
 * @param {any} functions The firebase functions library (ignored in test)
 * @return {FirebaseConfig} The config object
 */
function getConfig(functions: typeof FirebaseFunctions): FirebaseConfig {
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
    throw new Error(`Firebase config failed type guard. result:${result}`)
  }
}

/**
 * Override the firestore to use for tests. Need this so we can connect to the emulator.
 * @param {firestore.Firestore} firestore The firestore to override with
 * @param {Omit<FirebaseConfig, "sentry">} config The mock config to use for tests. (We exclude
 * Sentry-related configuration from this, as Sentry is configured upon importing the module
 * in which the functions are defined, so it is not readily amenable to being subsequently
 * modified as part of test setup, and we have no need to make it thusly modifiable.)
 */
function setEnvForTest(firestore: firestore.Firestore, config: Omit<FirebaseConfig, "sentry">): void {
  _firestoreForTest = firestore
  _configForTest = {
    ..._configForTest,
    ...config,
  }
}

export {getUsers, getDestroyedUsers, getAgreements, getDb, getConfig, setEnvForTest}
