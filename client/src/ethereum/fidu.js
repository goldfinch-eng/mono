import BigNumber from "bignumber.js"
import { ETHDecimals } from "./utils"

const FIDU_DECIMALS = ETHDecimals

function fiduFromAtomic(amount) {
  return new BigNumber(String(amount)).div(FIDU_DECIMALS).toString(10)
}

function fiduToAtomic(amount) {
  return new BigNumber(String(amount)).multipliedBy(FIDU_DECIMALS).toString(10)
}

export { FIDU_DECIMALS, fiduFromAtomic, fiduToAtomic }
