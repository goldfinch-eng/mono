import {KYC} from "../../hooks/useGoldfinchClient"

export const START = "start"
export const SIGN_IN = "sign_in"
export const VERIFY_ADDRESS = "verify_address"
export const CREATE_UID = "create_uid"
export const END = "end"
export const US_COUNTRY_CODE = "US"

export type Step = typeof START | typeof SIGN_IN | typeof VERIFY_ADDRESS | typeof CREATE_UID | typeof END
export type State =
  | {step: typeof START | typeof SIGN_IN | typeof VERIFY_ADDRESS | typeof END}
  | {step: typeof CREATE_UID; kyc?: KYC}
export type Action =
  | {type: typeof START | typeof SIGN_IN | typeof VERIFY_ADDRESS | typeof END}
  | {type: typeof CREATE_UID; kyc?: KYC}
