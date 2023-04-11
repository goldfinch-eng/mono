import {firestore} from "firebase-admin"

let _firestoreForTest: firestore.Firestore

/**
 * Get the users collection given a reference to the firestore
 * @param {firestore.Firestore} firestore The firestore to get the collection from (ignored for tests)
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getUsers(firestore: firestore.Firestore): firestore.CollectionReference<firestore.DocumentData> {
  return getCollection("users", firestore)
}

/**
 * Get the destroyed users collection given a reference to the firestore
 * @param {firestore.Firestore} firestore The firestore to get the collection from (ignored for tests)
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getDestroyedUsers(firestore: firestore.Firestore): firestore.CollectionReference<firestore.DocumentData> {
  return getCollection("destroyedUsers", firestore)
}

/**
 * Get the agreements collection given a reference to the firestore
 * @param {firestore.Firestore} firestore The firestore to get the collection from (ignored for tests)
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
function getAgreements(firestore: firestore.Firestore): firestore.CollectionReference<firestore.DocumentData> {
  return getCollection("agreements", firestore)
}

/**
 * Generic function to get any collection given a reference to the name and the firestore (test aware)
 * @param {string} collection The collection name
 * @param {firestore.Firestore} firestore The firestore to get the collection from (ignored for tests)
 * @return {firestore.CollectionReference} A Collection object that can be queried
 */
const getCollection = (
  collection: string,
  firestore: firestore.Firestore,
): firestore.CollectionReference<firestore.DocumentData> => {
  let collectionPrefix = ""

  if (process.env.NODE_ENV === "test") {
    collectionPrefix = "test_"
  }
  const collectionName = `${collectionPrefix}${collection}`
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

/**
 * Override the firestore to use for tests. Need this so we can connect to the emulator.
 * @param {firestore.Firestore} firestore The firestore to override with
 */
function setTestFirestore(firestore: firestore.Firestore): void {
  _firestoreForTest = firestore
}

export {getUsers, getDestroyedUsers, getAgreements, getDb, setTestFirestore}
