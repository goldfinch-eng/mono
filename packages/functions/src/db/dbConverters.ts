import {FirestoreDataConverter, DocumentData} from "firebase-admin/firestore"
import {Agreement, DestroyedUser, User} from "./dbTypes"
import {removeUndefinedProperties} from "../helpers"

const firestoreConverters: <T>() => FirestoreDataConverter<T> = <T>() => {
  return {
    toFirestore(data: FirebaseFirestore.WithFieldValue<T>): DocumentData {
      // Keep null values on writes so on merges we can "clear" previously non-null fields
      return removeUndefinedProperties(data, {removeNull: false}) as DocumentData
    },

    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): T {
      return removeUndefinedProperties(snapshot.data(), {removeNull: true}) as T
    },
  }
}

export const AgreementsConverter = firestoreConverters<Agreement>()
export const DestroyedUsersConverter = firestoreConverters<DestroyedUser>()
export const UsersConverter = firestoreConverters<User>()
