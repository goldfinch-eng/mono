import * as admin from "firebase-admin"
import firestore = admin.firestore

let firestoreForTest: firestore.Firestore
let configForTest: Record<string, any>

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
    return firestoreForTest
  } else {
    return firestore
  }
}

/**
 * Get the firebase confiog (test aware)
 * @param {any} functions The firebase functions library (ignored in test)
 * @return {Record<string, any>} The config object
 */
function getConfig(functions: any): Record<string, any> {
  if (process.env.NODE_ENV === "test") {
    return configForTest
  } else {
    return functions.config()
  }
}

/**
 * Override the firestore to use for tests. Need this so we can connect to the emulator
 * @param {firestore.Firestore} firestore The firestore to override with
 * @param {Record<string, any>} config The mock config to use for tests
 */
function setEnvForTest(firestore: firestore.Firestore, config: Record<string, any>): void {
  firestoreForTest = firestore
  configForTest = config
}

export {getUsers, getDb, getConfig, setEnvForTest}
