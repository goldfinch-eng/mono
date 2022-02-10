import accreditedList from "./accredited.json"

export function isAccredited(address: string): boolean {
  return accreditedList.includes(address)
}
