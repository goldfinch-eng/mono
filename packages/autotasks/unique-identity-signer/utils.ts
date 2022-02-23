import {KYC} from "."
import accreditedList from "./accredited.json"

const US_COUNTRY_CODE = "US"
const ID_TYPE_0 = 0 // non-US
const ID_TYPE_1 = 1 // US accredited
const ID_TYPE_2 = 2 // US non accredited

export function isAccredited(address: string): boolean {
  return accreditedList.includes(address)
}

export function getIDType({address, kycStatus}: {address: string; kycStatus: KYC}): number {
  let idVersion: number

  if (kycStatus.countryCode === US_COUNTRY_CODE && isAccredited(address)) {
    // US accredited
    idVersion = ID_TYPE_1
  } else if (kycStatus.countryCode === US_COUNTRY_CODE && !isAccredited(address)) {
    // US non accredited
    idVersion = ID_TYPE_2
  } else {
    // non US
    idVersion = ID_TYPE_0
  }

  return idVersion
}
