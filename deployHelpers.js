const BN = require('bn.js');
// Using 1e6, because that's what USDC is.
const USDCDecimals = new BN(String(1e6));
const ETHDecimals = new BN(String(1e18));

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f"
const LOCAL = "local";
const ROPSTEN = "ropsten";
const MAINNET = "mainnet";
const CHAIN_MAPPING = {
  "31337": LOCAL,
  "3": ROPSTEN,
  "1": MAINNET,
}
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935");

module.exports = {
  CHAIN_MAPPING: CHAIN_MAPPING,
  ROPSTEN_USDC_ADDRESS: ROPSTEN_USDC_ADDRESS,
  LOCAL: LOCAL,
  MAINNET: MAINNET,
  USDCDecimals: USDCDecimals,
  MAX_UINT: MAX_UINT,
  ETHDecimals: ETHDecimals,
}