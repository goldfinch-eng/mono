import {firestore} from "firebase-admin"
import {FirebaseConfig, setTestConfig} from "./config"
import {initializeTestEnvironment, RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"

// Optionally override the firestore for testing or emulation
let _firestore: firestore.Firestore

/**
 * Setup firebase test env by creating a test firestore
 * @param {string} projectId project id
 * @param {Omit<FirebaseConfig, "sentry">} config testing config
 * @return {Object} the test env and test context
 */
async function initializeFirebaseTestEnv(
  projectId: string,
  config?: Omit<FirebaseConfig, "sentry" | "parallelmarkets">,
): Promise<{testEnv: RulesTestEnvironment; testContext: RulesTestContext}> {
  const rules =
    "service cloud.firestore {" +
    "  match /databases/{database}/documents {" +
    "    match /{document=**} {" +
    "      allow read, write: if true;" +
    "    }" +
    "  }" +
    "}"
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules,
    },
  })
  const testContext = testEnv.unauthenticatedContext()

  // test firestores are a little different than the production firestore
  // pretend that they're the same, we don't use any of the special commands
  overrideFirestore(testContext.firestore() as unknown as firestore.Firestore)

  if (config) {
    setTestConfig(config)
  }

  return {testEnv, testContext}
}

/**
 * Override the firestore to use for tests. Need this so we can connect to the emulator.
 * @param {firestore.Firestore} firestore The firestore to override with
 */
function overrideFirestore(firestore: firestore.Firestore): void {
  _firestore = firestore
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
  return _firestore || firestore()
}

export {getUsers, getDestroyedUsers, getAgreements, getDb, overrideFirestore, initializeFirebaseTestEnv}
