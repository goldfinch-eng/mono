import * as admin from "firebase-admin"
import {isPlainObject, isString, isStringOrUndefined} from "../../../utils/type"
import firestore = admin.firestore
import childProcess from "child_process"

const _commitIdForTest = childProcess.execSync("git rev-parse HEAD").toString("utf8")

let _firestoreForTest: firestore.Firestore
let _configForTest: FirebaseConfig = {
  kyc: {allowed_origins: ""},
  persona: {allowed_ips: ""},
  sentry: {
    dsn: "https://8c1adf3a336a4487b14ae1af080c26d1@o915675.ingest.sentry.io/5857894",
    release: _commitIdForTest,
    environment: "test",
  },
}

/**
 * Get the users collction give a reference to the firestore
 * @param {firestore.Firestore} firestore The firestore the get the collection from (ignored for tests)
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getUsers(firestore: firestore.Firestore): firestore.CollectionReference<firestore.DocumentData> {
  let collectionPrefix = ""

  if (process.env.NODE_ENV === "test") {
    collectionPrefix = "test_"
  }
  const collectionName = `${collectionPrefix}users`
  return getDb(firestore).collection(collectionName)
}

/**
 * Get the database (test aware)
 * @param {firestore.Firestore} firestore The default db if not test env
 * @return {firestore.Firestore} The databse for the current env
 */
function getDb(firestore: firestore.Firestore): firestore.Firestore {
  if (process.env.NODE_ENV === "test") {
    return _firestoreForTest
  } else {
    return firestore
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
function getConfig(functions: any): FirebaseConfig {
  const result = process.env.NODE_ENV === "test" ? _configForTest : functions.config()
  if (isFirebaseConfig(result)) {
    return result
  } else {
    throw new Error("Firebase config failed type guard.")
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

export {getUsers, getDb, getConfig, setEnvForTest}
