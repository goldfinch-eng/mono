import {eligibleForSeniorPool} from "./utils"
import {UserLoaded} from "./ethereum/user"

describe("eligibleForSeniorPool", () => {
  describe("goListed", () => {
    it("returns true if golisted", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: true,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns false if not golisted", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: false,
            },
          },
        } as UserLoaded)
      ).toEqual(false)
    })
  })
  describe("hasUSAccreditedUID", () => {
    it("returns true if hasUSAccreditedUID", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              hasUSAccreditedUID: true,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns false if not hasUSAccreditedUID", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              hasUSAccreditedUID: false,
            },
          },
        } as UserLoaded)
      ).toEqual(false)
    })
  })
  describe("hasNonUSUID", () => {
    it("returns true if hasNonUSUID", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              hasNonUSUID: true,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns false if not hasNonUSUID", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              hasNonUSUID: false,
            },
          },
        } as UserLoaded)
      ).toEqual(false)
    })
  })

  describe("goListed || hasUSAccreditedUID || hasNonUSUID", () => {
    it("returns true if all true", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: true,
              hasUSAccreditedUID: true,
              hasNonUSUID: true,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns true if goListed true", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: true,
              hasUSAccreditedUID: false,
              hasNonUSUID: false,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns true if hasUSAccreditedUID true", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: false,
              hasUSAccreditedUID: true,
              hasNonUSUID: false,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns true if hasNonUSUID true", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: false,
              hasUSAccreditedUID: false,
              hasNonUSUID: true,
            },
          },
        } as UserLoaded)
      ).toEqual(true)
    })

    it("returns false if all false", async () => {
      expect(
        eligibleForSeniorPool({
          info: {
            value: {
              goListed: false,
              hasUSAccreditedUID: false,
              hasNonUSUID: false,
            },
          },
        } as UserLoaded)
      ).toEqual(false)
    })
  })
})
