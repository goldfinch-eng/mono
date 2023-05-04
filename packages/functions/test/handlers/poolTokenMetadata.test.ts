import chai from "chai"
import chaiSubset from "chai-subset"
import * as firebaseTesting from "@firebase/rules-unit-testing"
import * as admin from "firebase-admin"

import {poolTokenMetadata} from "../../src"

import firestore = admin.firestore
import Firestore = firestore.Firestore
import {Request} from "express"
import {expectResponse} from "../utils"
import {setTestConfig} from "../../src/config"
import {overrideFirestore} from "../../src/db"

chai.use(chaiSubset)

describe("poolTokenMetadata", async () => {
  let testFirestore: Firestore
  let testApp: admin.app.App
  const projectId = "goldfinch-frontend-test"

  beforeEach(() => {
    testApp = firebaseTesting.initializeAdminApp({projectId: projectId})
    testFirestore = testApp.firestore()
    overrideFirestore(testFirestore)
    setTestConfig({
      kyc: {allowed_origins: "http://localhost:3000"},
      persona: {allowed_ips: ""},
    })
  })

  afterEach(async () => {
    await firebaseTesting.clearFirestoreData({projectId})
  })

  describe("poolTokenMetadata", async () => {
    it("checks if token id is present", async () => {
      await poolTokenMetadata(
        {
          path: "some/thing/",
        } as unknown as Request,
        expectResponse(400, {status: "error", message: "Missing token ID"}),
      )
    })

    it("checks if token id is a number", async () => {
      await poolTokenMetadata(
        {
          path: "some/thing/a",
        } as unknown as Request,
        expectResponse(400, {status: "error", message: "Token ID must be a number"}),
      )
    })

    it("checks if token id is from an invalid pool", async () => {
      await poolTokenMetadata(
        {
          path: "some/thing/3",
        } as unknown as Request,
        expectResponse(404, {status: "error", message: "Requesting token for invalid pool"}),
      )
    })
  })
})
