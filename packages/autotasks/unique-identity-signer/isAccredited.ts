import * as accreditedlist from "./accredited.json"

export function isAccredited(address: string): boolean {
  return accreditedlist.includes(address)
}
