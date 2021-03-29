import web3 from "../web3"
import { ONE_INCH_ADDRESSES } from "./utils.js"

const OneInchAbi = require("../../abi/OneSplit.json")

function getOneInchContract(networkId) {
  return new web3.eth.Contract(OneInchAbi, ONE_INCH_ADDRESSES[networkId])
}

export { getOneInchContract }
