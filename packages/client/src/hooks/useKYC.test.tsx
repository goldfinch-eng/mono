import {eligibleForSeniorPool} from "./useKYC"
import {UserLoaded} from "../ethereum/user"

describe("eligibleForSeniorPool", () => {
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
