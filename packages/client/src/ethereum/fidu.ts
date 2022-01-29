import BigNumber from "bignumber.js"

export const FIDU_DECIMAL_PLACES = 18
export const FIDU_DECIMALS = new BigNumber(String(10 ** FIDU_DECIMAL_PLACES))

/**
 * Returns the number of Fidu tokens given a number of atoms
 * @param amount number of Fidu atoms as a string
 * @returns amount of Fidu tokens as a string
 */
export function fiduFromAtomic(amount: string | BigNumber): string {
  return new BigNumber(String(amount)).div(FIDU_DECIMALS).toString(10)
}

/**
 * Return the number of Fidu atoms given a number of Fidu tokens
 * @param amount amount of fidu tokens as a string
 * @returns amount of fidu atoms as a string
 */
export function fiduToAtomic(amount: string | BigNumber): string {
  return new BigNumber(String(amount)).multipliedBy(FIDU_DECIMALS).toString(10)
}

export function fiduToDollarsAtomic(fiduAmount: BigNumber, sharePrice: BigNumber): BigNumber {
  return fiduAmount.multipliedBy(sharePrice).div(
    // This might be better thought of as dividing by the share-price mantissa,
    // which happens to be the same as `FIDU_DECIMALS`.
    FIDU_DECIMALS
  )
}
export function fiduInDollars(fiduInDollarsAtomic: BigNumber): BigNumber {
  return new BigNumber(fiduFromAtomic(fiduInDollarsAtomic))
}
