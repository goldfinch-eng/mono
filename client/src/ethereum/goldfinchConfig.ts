import {fetchDataFromAttributes} from "./utils"
import {CONFIG_KEYS} from "../../../blockchain_scripts/configKeys"

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
