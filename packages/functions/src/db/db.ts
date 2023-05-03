import {firestore} from "firebase-admin"
import {AgreementsConverter} from "./dbConverters"
import {Agreement} from "./dbTypes"

// Optionally override the firestore for testing or emulation
let _firestore: firestore.Firestore

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
 * @return {firestore.CollectionReference<Agreement>} A Collection object that can be queried
 */
function getAgreements(): firestore.CollectionReference<Agreement> {
  return getCollection("agreements").withConverter(AgreementsConverter)
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

export {getUsers, getDestroyedUsers, getAgreements, getDb, overrideFirestore}
