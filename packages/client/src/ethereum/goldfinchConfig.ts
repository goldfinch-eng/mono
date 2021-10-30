import {fetchDataFromAttributes} from "./utils"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {BlockInfo} from "../utils"
import {GoldfinchConfig} from "@goldfinch-eng/protocol/typechain/web3/GoldfinchConfig"
import BigNumber from "bignumber.js"

export type GoldfinchConfigData = GoldfinchConfig & {
  transactionLimit: BigNumber
  totalFundsLimit: BigNumber
}

async function refreshGoldfinchConfigData(
  goldfinchConfigContract: GoldfinchConfig,
  currentBlock: BlockInfo
): Promise<GoldfinchConfigData> {
  const attributes = [
    {method: "getNumber", args: [CONFIG_KEYS.TransactionLimit], name: "transactionLimit"},
    {method: "getNumber", args: [CONFIG_KEYS.TotalFundsLimit], name: "totalFundsLimit"},
  ]
  const data = await fetchDataFromAttributes(goldfinchConfigContract, attributes, {
    bigNumber: true,
    blockNumber: currentBlock.number,
  })
  return {...goldfinchConfigContract, ...data}
}

export {refreshGoldfinchConfigData}
