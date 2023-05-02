import chai from "chai"
import chaiSubset from "chai-subset"

import {poolTokenMetadata} from "../../src"

import {Request} from "express"
import {expectResponse} from "../utils"

chai.use(chaiSubset)

describe("poolTokenMetadata", async () => {
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
