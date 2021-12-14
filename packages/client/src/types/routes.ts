export const INDEX_ROUTE = "/"
export const EARN_ROUTE = "/earn"
export const ABOUT_ROUTE = "/about"
export const REWARDS_ROUTE = "/rewards"
export const BORROW_ROUTE = "/borrow"
export const TRANSACTIONS_ROUTE = "/transactions"
export const SENIOR_POOL_ROUTE = "/pools/senior"
export const TRANCHED_POOL_ROUTE = "/pools/:poolAddress"
export const VERIFY_ROUTE = "/verify"
export const TERMS_OF_SERVICE_ROUTE = "/terms"
export const PRIVACY_POLICY_ROUTE = "/privacy"
export const SENIOR_POOL_AGREEMENT_NON_US_ROUTE = "/senior-pool-agreement-non-us"

export type AppRoute =
  | typeof INDEX_ROUTE
  | typeof EARN_ROUTE
  | typeof ABOUT_ROUTE
  | typeof REWARDS_ROUTE
  | typeof BORROW_ROUTE
  | typeof TRANSACTIONS_ROUTE
  | typeof SENIOR_POOL_ROUTE
  | typeof TRANCHED_POOL_ROUTE
  | typeof VERIFY_ROUTE
  | typeof TERMS_OF_SERVICE_ROUTE
  | typeof PRIVACY_POLICY_ROUTE
  | typeof SENIOR_POOL_AGREEMENT_NON_US_ROUTE
export function isAppRoute(val: unknown): val is AppRoute {
  return (
    val === INDEX_ROUTE ||
    val === EARN_ROUTE ||
    val === ABOUT_ROUTE ||
    val === REWARDS_ROUTE ||
    val === BORROW_ROUTE ||
    val === TRANSACTIONS_ROUTE ||
    val === SENIOR_POOL_ROUTE ||
    val === TRANCHED_POOL_ROUTE ||
    val === VERIFY_ROUTE ||
    val === TERMS_OF_SERVICE_ROUTE ||
    val === PRIVACY_POLICY_ROUTE ||
    val === SENIOR_POOL_AGREEMENT_NON_US_ROUTE
  )
}
