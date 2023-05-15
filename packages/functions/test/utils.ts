import chai from "chai"
import chaiSubset from "chai-subset"
chai.use(chaiSubset)
const expect = chai.expect
import {Response} from "firebase-functions"
import {FirebaseConfig, setTestConfig} from "../src/config"
import firebase from "firebase/compat/app"
import {firestore} from "firebase-admin"
import {initializeTestEnvironment, RulesTestEnvironment, RulesTestContext} from "@firebase/rules-unit-testing"
import {overrideFirestore} from "../src/db/db"

/**
 * Assert a response object of a cloud function matches the expected http status code and reponse body.
 * https://firebase.google.com/docs/functions/unit-testing#testing_http_functions
 * @param {number} expectedCode expected HTTP response status
 * @param {number} expectedBody expected response body
 * @return {any}
 */
const expectResponse = function (expectedCode: number, expectedBody: Record<string, unknown>): Response {
  return {
    status: (actualCode: number) => {
      expect(actualCode).to.eq(expectedCode)
      return {
        send: async (actualBody: Record<string, unknown>) => {
          if (Object.keys(expectedBody).length === 0) {
            return expect(Object.keys(actualBody).length).to.eq(0, "Assertion empty body")
          } else {
            return expect(actualBody).to.containSubset(expectedBody)
          }
        },
      }
    },
  } as unknown as Response
}

/**
 * Assert a firestore collection is of the expected size
 * @param {firebase.firestore.CollectionReference<firebase.firestore.DocumentData>} collection  the firestore collection to check
 * @param {number} size the expected size (number of documents) in the collection
 */
const expectSize = async (
  collection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>,
  size: number,
) => {
  expect((await collection.get()).size).to.equal(size)
}

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

export {expectResponse, expectSize, initializeFirebaseTestEnv}
