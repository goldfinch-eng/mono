import web3 from '../web3';
import BN from 'bn.js';
import BigNumber from "bignumber.js"
import * as ERC20Contract from '../../../artifacts/TestERC20.json';
import * as ProtocolConfig from '../../config/protocol-local.json';
const decimalPlaces = 6;
const decimals = new BN(String(10 ** decimalPlaces));
const erc20 = new web3.eth.Contract(ERC20Contract.abi, ProtocolConfig.erc20.address);

function fromAtomic(amount) {
  return new BigNumber(String(amount)).div(decimals).toString(10);
}

function toAtomic(amount) {
  return new BigNumber(String(amount)).multipliedBy(decimals).toString(10);
}

export {
  erc20,
  decimals,
  fromAtomic,
  toAtomic,
}
