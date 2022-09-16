import {AbiItem} from "web3-utils/types"

import getWeb3 from "../web3"
import {GoldfinchProtocol} from "./GoldfinchProtocol"
import * as CurvePoolContract from "./CurvePool.json"
import {Web3IO} from "../types/web3"
import {ICurveLP as CurveContract} from "@goldfinch-eng/protocol/typechain/web3/ICurveLP"

const MAINNET_FIDU_USDC_CURVE_LP_ADDRESS = "0x80aa1a80a30055DAA084E599836532F3e58c95E2"

export function getCurvePoolContract(goldfinchProtocol: GoldfinchProtocol): Web3IO<CurveContract> {
  const localContract = goldfinchProtocol.deployments.contracts["TestFiduUSDCCurveLP"]
  const web3 = getWeb3()
  let address
  if (localContract) {
    // Use the locally deployed contract if we're on localhost
    address = localContract.address
  } else {
    // Otherwise use the existing Curve pool contract if we're on mainnet or mainnet forking
    address = MAINNET_FIDU_USDC_CURVE_LP_ADDRESS
  }
  const readOnly = new web3.readOnly.eth.Contract(
    CurvePoolContract.abi as AbiItem[],
    address
  ) as unknown as CurveContract
  ;(readOnly as any).loaded = true
  const userWallet = new web3.userWallet.eth.Contract(
    CurvePoolContract.abi as AbiItem[],
    address
  ) as unknown as CurveContract
  ;(userWallet as any).loaded = true
  return {readOnly, userWallet}
}
