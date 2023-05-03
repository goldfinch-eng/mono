import {FirestoreDataConverter, DocumentData} from "firebase-admin/firestore"
import {Agreement} from "./dbTypes"

export const AgreementsConverter: FirestoreDataConverter<Agreement> = {
  toFirestore(agreement: Agreement): DocumentData {
    return agreement
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Agreement {
    return snapshot.data() as Agreement
  },
}
