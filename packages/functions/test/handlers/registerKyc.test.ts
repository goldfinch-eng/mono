import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"
import {setTestConfig} from "../../src/config"
import {setTestFirestore, getUsers} from "../../src/db"

import firestore = admin.firestore
import Firestore = firestore.Firestore

describe.skip("registerKyc", async () => {
  const projectId = "goldfinch-frontend-test"

  let testFirestore: Firestore
  let testApp: admin.app.App
  let users: firestore.CollectionReference<firestore.DocumentData>

  beforeEach(async () => {
    testApp = firebaseTesting.initializeAdminApp({projectId})
    testFirestore = testApp.firestore()
    setTestFirestore(testFirestore)
    setTestConfig({
      kyc: {allowed_origins: "http://localhost:3000"},
      slack: {token: "slackToken"},
      persona: {
        allowed_ips: "",
      },
    })
    users = getUsers(testFirestore)
  })

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId})
  })

  // describe("parallel markets", () => {
  //   describe("validating payload", () => {
  //     it("ensures key is present", async () => {})

  //     it("ensures provider is present", async () => {})

  //     it("ensures provider is valid is present", async () => {})
  //   })

  //   describe("creating new user", () => {
  //     it("with correct fields", () => {})
  //   })

  //   describe("updatings existing user", () => {
  //     it("resets revocations", () => {})

  //     it("overwrites fields", () => {})

  //     it("works for businesses", () => {})

  //     it("works for individualtes", () => {})

  //     it("sets country to US if resident or citizen", () => {})

  //     it("gives no accreditation if all documents invalid", () => {})

  //     it("does not pass identity if match level is not high", () => {})
  //   })
  // })
})
