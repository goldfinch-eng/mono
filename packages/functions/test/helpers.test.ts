import chai from "chai"
import chaiSubset from "chai-subset"
import {originAllowed} from "../src/helpers"

chai.use(chaiSubset)
const expect = chai.expect

describe("originAllowed", () => {
  const allowedOrigins = ["http://localhost:3000", "https://deploy-preview*netlify.app"]
  it("should allow wildcards", () => {
    expect(originAllowed(allowedOrigins, "https://deploy-preview-512-goldfinch-netlify.app")).to.be.true
  })

  it("should allow direct matches", () => {
    expect(originAllowed(allowedOrigins, "http://localhost:3000")).to.be.true
  })

  it("should not allow incorrect direct matches", () => {
    expect(originAllowed(allowedOrigins, "http://localshot:3001")).to.be.false
  })

  it("should not allow incorrect wildcard matches", () => {
    expect(originAllowed(allowedOrigins, "https://deploy-prev-goldfinch.netlify.app")).to.be.false
  })
})
