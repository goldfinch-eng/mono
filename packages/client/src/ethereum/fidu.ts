import web3 from "../web3"
import BigNumber from "bignumber.js"
import BN from "bn.js"
import {getDeployments} from "./utils"

async function getFidu(networkId) {
  const config = await getDeployments(networkId)
  const fiduContract = config.contracts.Fidu
  // @ts-expect-error ts-migrate(2349) FIXME: This expression is not callable.
  const fidu = (new web3.eth.Contract(fiduContract.abi, fiduContract.address)(fidu as any).chain = networkId)
  return fidu
}

const FIDU_DECIMAL_PLACES = 18
const FIDU_DECIMALS = new BN(String(10 ** FIDU_DECIMAL_PLACES))

function fiduFromAtomic(amount) {
  // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'BN' is not assignable to paramet... Remove this comment to see the full error message
  return new BigNumber(String(amount)).div(FIDU_DECIMALS).toString(10)
}

function fiduToAtomic(amount) {
  // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'BN' is not assignable to paramet... Remove this comment to see the full error message
  return new BigNumber(String(amount)).multipliedBy(FIDU_DECIMALS).toString(10)
}

export {getFidu, FIDU_DECIMALS, FIDU_DECIMAL_PLACES, fiduFromAtomic, fiduToAtomic}
