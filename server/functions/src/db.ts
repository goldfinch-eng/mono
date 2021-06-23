import * as admin from "firebase-admin"
import firestore = admin.firestore

let firestoreForTest: firestore.Firestore

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
 * Override the firestore to use for tests. Need this so we can connect to the emulator
 * @param {firestore.Firestore} firestore The firestore to override with
 */
function setFirestoreForTest(firestore: firestore.Firestore): void {
  firestoreForTest = firestore
}

export {getUsers, getDb, setFirestoreForTest}
