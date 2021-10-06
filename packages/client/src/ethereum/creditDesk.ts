import web3 from "../web3"
import {getDeployments} from "./utils"

async function getCreditDesk(networkId) {
  const config = await getDeployments(networkId)
  const creditDeskAddress = config.contracts.CreditDesk.address
  // @ts-expect-error ts-migrate(2349) FIXME: This expression is not callable.
  const creditDesk = (new web3.eth.Contract(config.contracts.CreditDesk.abi, creditDeskAddress)(
    // @ts-expect-error ts-migrate(2448) FIXME: Block-scoped variable 'creditDesk' used before its... Remove this comment to see the full error message
    creditDesk as any
  ).chain = networkId)
  ;(creditDesk as any).loaded = true
  return creditDesk
}

export {getCreditDesk}
