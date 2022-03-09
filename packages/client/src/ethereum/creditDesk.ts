import getWeb3 from "../web3"
import {getDeployments} from "./utils"

export async function getCreditDeskReadOnly(networkId) {
  const config = await getDeployments(networkId)
  const creditDeskAddress = config.contracts.CreditDesk.address
  const web3 = getWeb3()
  const creditDesk = new web3.readOnly.eth.Contract(config.contracts.CreditDesk.abi, creditDeskAddress)
  ;(creditDesk as any).chain = networkId
  ;(creditDesk as any).loaded = true
  return creditDesk
}
