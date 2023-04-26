import chai from "chai"
import AsPromised from "chai-as-promised"
chai.use(AsPromised)

import {
  USAccreditedIndividualsList,
  USAccreditedEntitiesList,
  NonUSEntitiesList,
  caseInsensitiveIncludes,
} from "@goldfinch-eng/utils"

describe("unique-identity-signer utils", () => {
  describe("caseInsensitiveIncludes", () => {
    it("case insensitively matches an array element", () => {
      const data = [
        "0x11Cb600E4740C052855B942dC13648d7dF1503E5",
        "0x7Fb2EdA1a56BAEC8a5f1764948D3B1de03059950",
        "0x47BdbA50F035bAF1Bd9A41Da3cD7fc6bc198049f",
        "0xD98a107A56c2DE8aFD8416a5AeF3Fb63Ea277B07",
        "0xdCA313c4Df33c2142B2aDf202D6AbF4Fa56e1d41",
        "0x55d601F005ae4984314951F9219D097d91EedCae",
        "0x111B46bFAe308Be4570Cb9F17d051B58022D7c89",
        "0X8F40DCD6BA523561A8A497001896330965520FA4",
      ]

      const testAddress = "0X8F40DCD6ba523561a8a497001896330965520FA4"
      const testAddressLowerCase = testAddress.toLowerCase()
      const testAddressUppwerCase = testAddress.toUpperCase()
      const notInTheArray = "0X8F40DCD6ba523561a8a497001896330965520000"

      expect(caseInsensitiveIncludes(data, testAddress)).to.be.true
      expect(caseInsensitiveIncludes(data, testAddressLowerCase)).to.be.true
      expect(caseInsensitiveIncludes(data, testAddressUppwerCase)).to.be.true
      expect(caseInsensitiveIncludes(data, notInTheArray)).to.be.false
    })
  })

  describe("eligible json files", () => {
    it("checks for duplicates", () => {
      const data = [USAccreditedIndividualsList, USAccreditedEntitiesList, NonUSEntitiesList]
      data.reduce((acc, curr) => {
        if (acc.some((x) => curr.includes(x))) {
          throw new Error("Array intersection")
        }
        return [...acc, ...curr]
      })
      return true
    })
  })
})
