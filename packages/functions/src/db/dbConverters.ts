import {FirestoreDataConverter, DocumentData} from "firebase-admin/firestore"
import {Agreement, DestroyedUser} from "./dbTypes"

const firestoreConverters: <T>() => FirestoreDataConverter<T> = <T>() => {
  return {
    toFirestore(data: FirebaseFirestore.WithFieldValue<T>): DocumentData {
      return data as DocumentData
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): T {
      return snapshot.data() as T
    },
  }
}

export const AgreementsConverter = firestoreConverters<Agreement>()
export const DestroyedUsersConverter = firestoreConverters<DestroyedUser>()
