export const START = "start"
export const SIGN_IN = "sign_in"
export const VERIFY_ADDRESS = "verify_address"
export const CREATE_UID = "create_uid"
export const END = "end"
export const US_COUNTRY_CODE = "US"

export type Step = typeof START | typeof SIGN_IN | typeof VERIFY_ADDRESS | typeof CREATE_UID | typeof END
export type Action = {type: Step}
