import {fetchDataFromAttributes} from "./utils"
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@goldfinch-eng/protocol/blockc... Remove this comment to see the full error message
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"

async function refreshGoldfinchConfigData(goldfinchConfigContract) {
  if (!goldfinchConfigContract) {
    return Promise.resolve({})
  }
  const attributes = [
    {method: "getNumber", args: [CONFIG_KEYS.TransactionLimit], name: "transactionLimit"},
    {method: "getNumber", args: [CONFIG_KEYS.TotalFundsLimit], name: "totalFundsLimit"},
  ]
  const data = await fetchDataFromAttributes(goldfinchConfigContract, attributes, {bigNumber: true})
  return {...goldfinchConfigContract, ...data}
}

export {refreshGoldfinchConfigData}
