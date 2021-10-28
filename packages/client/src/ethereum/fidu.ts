import web3 from "../web3"
import BigNumber from "bignumber.js"
import {getDeployments} from "./utils"
import {Contract} from "web3-eth-contract"

export const FIDU_DECIMAL_PLACES = 18
export const FIDU_DECIMALS = new BigNumber(String(10 ** FIDU_DECIMAL_PLACES))

/**
 * Returns a Fidu contract deployed on a given network
 * @param networkId network to get deployed fidu on
 * @returns Fidu contract
 */
export async function getFidu(networkId: string): Promise<Contract> {
  const config = await getDeployments(networkId)
  const fiduContract = config.contracts.Fidu
  const fidu = new web3.eth.Contract(fiduContract.abi, fiduContract.address)
  ;(fidu as any).chain = networkId
  return fidu
}

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

export function sharesToBalance(shares: BigNumber, sharePrice: BigNumber): BigNumber {
  return shares.multipliedBy(sharePrice).div(FIDU_DECIMALS)
}
export function sharesBalanceInDollars(balance: BigNumber): BigNumber {
  return new BigNumber(fiduFromAtomic(balance))
}
