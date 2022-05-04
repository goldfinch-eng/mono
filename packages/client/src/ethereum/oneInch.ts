import {isArrayOfString, isString, PlainObject} from "@goldfinch-eng/utils/src/type"
import {Contract} from "web3-eth-contract"

import {Web3IO} from "../types/web3"
import getWeb3 from "../web3"
import {ONE_INCH_ADDRESSES} from "./utils"

const OneInchAbi = require("../../abi/OneSplit.json")

export function getOneInchContract(networkId): Web3IO<Contract> {
  const address = ONE_INCH_ADDRESSES[networkId]
  const web3 = getWeb3()
  const readOnly = new web3.readOnly.eth.Contract(OneInchAbi, address)
  const userWallet = new web3.userWallet.eth.Contract(OneInchAbi, address)
  return {readOnly, userWallet}
}

export type OneInchExpectedReturn = {
  returnAmount: string
  distribution: string[]
}

export const isOneInchExpectedReturn = (obj: unknown): obj is OneInchExpectedReturn =>
  isString((obj as PlainObject).returnAmount) && isArrayOfString((obj as PlainObject).distribution)
