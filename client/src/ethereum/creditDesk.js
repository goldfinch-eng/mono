import BigNumber from "bignumber.js"
import web3 from "../web3"
import _ from "lodash"
import {buildCreditLine} from "./creditLine"
import {getDeployments, getFromBlock, fetchDataFromAttributes, INTEREST_DECIMALS} from "./utils"

async function getCreditDesk(networkId) {
  const config = await getDeployments(networkId)
  const creditDeskAddress = config.contracts.CreditDesk.address
  const creditDesk = new web3.eth.Contract(config.contracts.CreditDesk.abi, creditDeskAddress)
  creditDesk.chain = networkId
  creditDesk.loaded = true
  return creditDesk
}

export {getCreditDesk}
