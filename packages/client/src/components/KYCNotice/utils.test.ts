import {GeolocationData} from "../../App"
import {SENIOR_POOL_AGREEMENT_NON_US_ROUTE, SENIOR_POOL_AGREEMENT_US_ROUTE} from "../../types/routes"
import {getLegalLanguage} from "./utils"

describe("getLegalLanguage", () => {
  describe("US Geolocation", () => {
    it("returns the proper title, message, and legal route", async () => {
      const country = "US"
      const {title, message, seniorPoolLegalRoute} = getLegalLanguage({
        user: {
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
        allowedUIDTypes: [1],
        geolocation: {country} as GeolocationData,
      })
      expect(title).toEqual("This offering is only available to accredited U.S. persons.")
      expect(message).toEqual(
        "This offering is only available to accredited U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom."
      )
      expect(seniorPoolLegalRoute).toEqual(SENIOR_POOL_AGREEMENT_US_ROUTE)
    })
  })

  describe("CA County code but has accredited UID", () => {
    it("returns the proper title, message, and legal route", async () => {
      const country = "CA"
      const {title, message, seniorPoolLegalRoute} = getLegalLanguage({
        user: {
          info: {
            value: {
              goListed: true,
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
        allowedUIDTypes: [1],
        geolocation: {country} as GeolocationData,
      })
      expect(title).toEqual("This offering is only available to accredited U.S. persons.")
      expect(message).toEqual(
        "This offering is only available to accredited U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom."
      )
      expect(seniorPoolLegalRoute).toEqual(SENIOR_POOL_AGREEMENT_US_ROUTE)
    })
  })

  describe("CA country code and has US entity UID", () => {
    it("returns the proper title, message, and legal route", async () => {
      const country = "CA"
      const {title, message, seniorPoolLegalRoute} = getLegalLanguage({
        user: {
          info: {
            value: {
              goListed: true,
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
        allowedUIDTypes: [1],
        geolocation: {country} as GeolocationData,
      })
      expect(title).toEqual("This offering is only available to accredited U.S. persons.")
      expect(message).toEqual(
        "This offering is only available to accredited U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom."
      )
      expect(seniorPoolLegalRoute).toEqual(SENIOR_POOL_AGREEMENT_US_ROUTE)
    })
  })

  describe("US country code but doesnt allow US investors", () => {
    it("returns the proper title, message, and legal route", async () => {
      const country = "US"
      const {title, message, seniorPoolLegalRoute} = getLegalLanguage({
        user: {
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
        allowedUIDTypes: [0],
        geolocation: {country} as GeolocationData,
      })
      expect(title).toEqual("This offering is only available to non-U.S. persons.")
      expect(message).toEqual(
        "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
      )
      expect(seniorPoolLegalRoute).toEqual(SENIOR_POOL_AGREEMENT_NON_US_ROUTE)
    })
  })

  describe("CA country code and Non-US Geolocation", () => {
    it("returns the proper title, message, and legal route", async () => {
      const country = "CA"
      const {title, message, seniorPoolLegalRoute} = getLegalLanguage({
        user: {
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
        allowedUIDTypes: [1],
        geolocation: {country} as GeolocationData,
      })
      expect(title).toEqual("This offering is only available to non-U.S. persons.")
      expect(message).toEqual(
        "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
      )
      expect(seniorPoolLegalRoute).toEqual(SENIOR_POOL_AGREEMENT_NON_US_ROUTE)
    })
  })

  describe("CA country code and does not allow US invetors", () => {
    it("returns the proper title, message, and legal route", async () => {
      const country = "CA"
      const allowedUIDTypes = [0]
      const {title, message, seniorPoolLegalRoute} = getLegalLanguage({
        user: {
          info: {
            value: {
              goListed: true,
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
        allowedUIDTypes,
        geolocation: {country} as GeolocationData,
      })
      expect(title).toEqual("This offering is only available to non-U.S. persons.")
      expect(message).toEqual(
        "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements."
      )
      expect(seniorPoolLegalRoute).toEqual(SENIOR_POOL_AGREEMENT_NON_US_ROUTE)
    })
  })
})
