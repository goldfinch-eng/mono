import {eligibleForSeniorPool} from "./utils"

describe.only("eligibleForSeniorPool", () => {
  describe("goListed", () => {
    it("returns true if golisted", async () => {
      expect(
        eligibleForSeniorPool(
          {
            info: {
              value: {
                goListed: true,
                uidTypeToBalance: {
                  "0": false,
                  "1": false,
                  "2": false,
                  "3": false,
                  "4": false,
                },
              },
            },
          } as any,
          [0, 1, 3, 4]
        )
      ).toEqual(true)
    })

    it("returns false if not golisted", async () => {
      expect(
        eligibleForSeniorPool(
          {
            info: {
              value: {
                goListed: false,
                uidTypeToBalance: {
                  "0": false,
                  "1": false,
                  "2": false,
                  "3": false,
                  "4": false,
                },
              },
            },
          } as any,
          [0, 1, 3, 4]
        )
      ).toEqual(false)
    })
  })

  it("returns true if hasUSAccreditedUID", async () => {
    expect(
      eligibleForSeniorPool(
        {
          info: {
            value: {
              goListed: false,
              uidTypeToBalance: {
                "0": false,
                "1": true,
                "2": false,
                "3": false,
                "4": false,
              },
            },
          },
        } as any,
        [0, 1, 3, 4]
      )
    ).toEqual(true)
  })

  it("returns false if has us no accredited uid", async () => {
    expect(
      eligibleForSeniorPool(
        {
          info: {
            value: {
              goListed: false,
              uidTypeToBalance: {
                "0": false,
                "1": false,
                "2": true,
                "3": false,
                "4": false,
              },
            },
          },
        } as any,
        [0, 1, 3, 4]
      )
    ).toEqual(false)
  })

  it("returns true if has us entity", async () => {
    expect(
      eligibleForSeniorPool(
        {
          info: {
            value: {
              goListed: false,
              uidTypeToBalance: {
                "0": false,
                "1": false,
                "2": false,
                "3": true,
                "4": false,
              },
            },
          },
        } as any,
        [0, 1, 3, 4]
      )
    ).toEqual(true)
  })

  it("returns true if non us entity", async () => {
    expect(
      eligibleForSeniorPool(
        {
          info: {
            value: {
              goListed: false,
              uidTypeToBalance: {
                "0": false,
                "1": false,
                "2": false,
                "3": false,
                "4": true,
              },
            },
          },
        } as any,
        [0, 1, 3, 4]
      )
    ).toEqual(true)
  })
})
