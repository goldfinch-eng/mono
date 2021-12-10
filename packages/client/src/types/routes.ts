export const INDEX_ROUTE = "/"
export type INDEX_ROUTE = typeof INDEX_ROUTE

export const EARN_ROUTE = "/earn"
export type EARN_ROUTE = typeof EARN_ROUTE

export const ABOUT_ROUTE = "/about"
export type ABOUT_ROUTE = typeof ABOUT_ROUTE

export const REWARDS_ROUTE = "/rewards"
export type REWARDS_ROUTE = typeof REWARDS_ROUTE

export const BORROW_ROUTE = "/borrow"
export type BORROW_ROUTE = typeof BORROW_ROUTE

export const TRANSACTIONS_ROUTE = "/transactions"
export type TRANSACTIONS_ROUTE = typeof TRANSACTIONS_ROUTE

export const SENIOR_POOL_ROUTE = "/pools/senior"
export type SENIOR_POOL_ROUTE = typeof SENIOR_POOL_ROUTE

export const TRANCHED_POOL_ROUTE = "/pools/:poolAddress"
export type TRANCHED_POOL_ROUTE = typeof TRANCHED_POOL_ROUTE

export const VERIFY_ROUTE = "/verify"
export type VERIFY_ROUTE = typeof VERIFY_ROUTE

export const TERMS_OF_SERVICE_ROUTE = "/terms"
export type TERMS_OF_SERVICE_ROUTE = typeof TERMS_OF_SERVICE_ROUTE

export const PRIVACY_POLICY_ROUTE = "/privacy"
export type PRIVACY_POLICY_ROUTE = typeof PRIVACY_POLICY_ROUTE

export const SENIOR_POOL_AGREEMENT_NON_US_ROUTE = "/senior-pool-agreement-non-us"
export type SENIOR_POOL_AGREEMENT_NON_US_ROUTE = typeof SENIOR_POOL_AGREEMENT_NON_US_ROUTE

export type AppRoute =
  | INDEX_ROUTE
  | EARN_ROUTE
  | ABOUT_ROUTE
  | REWARDS_ROUTE
  | BORROW_ROUTE
  | TRANSACTIONS_ROUTE
  | SENIOR_POOL_ROUTE
  | TRANCHED_POOL_ROUTE
  | VERIFY_ROUTE
  | TERMS_OF_SERVICE_ROUTE
  | PRIVACY_POLICY_ROUTE
  | SENIOR_POOL_AGREEMENT_NON_US_ROUTE
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
