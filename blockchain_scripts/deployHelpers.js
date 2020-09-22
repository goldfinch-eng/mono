const BN = require('bn.js');
// Using 1e6, because that's what USDC is.
const USDCDecimals = new BN(String(1e6));
const ETHDecimals = new BN(String(1e18));

const ROPSTEN_USDC_ADDRESS = "0x07865c6e87b9f70255377e024ace6630c1eaa37f";
const MAINNET_USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const LOCAL = "local";
const ROPSTEN = "ropsten";
const RINKEBY = "rinkeby";
const MAINNET = "mainnet";
const MAX_UINT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935");
const CHAIN_MAPPING = {
  "31337": LOCAL,
  "3": ROPSTEN,
  "1": MAINNET,
  "4": RINKEBY,
}
const USDC_MAPPING = {
  [ROPSTEN]: ROPSTEN_USDC_ADDRESS,
  [MAINNET]: MAINNET_USDC_ADDRESS
}
const MULTISIG_MAPPING = {
  [RINKEBY]: "0xcF0B329c04Fd92a7370de10458050Fc8124Cacbc",
}
function getUSDCAddress(chainID) {
  return USDC_MAPPING[chainID] || USDC_MAPPING[CHAIN_MAPPING[chainID]];
}

function getMultisigAddress(chainID) {
  return MULTISIG_MAPPING[chainID] || MULTISIG_MAPPING[CHAIN_MAPPING[chainID]];
}

async function upgrade(bre, contractName, deployOptions = {}) {
  const { deployments, getNamedAccounts } = bre;
  const { deploy, log } = deployments;
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  log("Attemping to upgrade", contractName);
  
  deployOptions.from = protocol_owner
  if (!deployOptions.contract) {
    deployOptions.contract = contractName;
  }
  log("Deploying implementation...");
  const implementationName = contractName + "_Implementation";
  const implementationReceipt = await deploy(implementationName, deployOptions);
  log("Implementation deployed to", implementationReceipt.address);

  const proxy = await getDeployedContract(deployments, contractName + "_Proxy", proxy_owner)

  // If we wanted to run any post upgrade functions or initializations or anything after the implementation deployment, 
  // then we would need to actually populate the data here. See https://github.com/wighawag/buidler-deploy/blob/e534fcdc7ffffe2511a48c04def54ae1acf532bc/src/helpers.ts#L854 for more
  log("Changing implementation...");
  let data = "0x";
  await proxy.changeImplementation(implementationReceipt.address, data);
  log("Upgrade complete");
  // This should return the new implementation, but with the address of the Proxy.
  implementationReceipt.address = proxy.address;
  return implementationReceipt;
}

async function getDeployedContract(deployments, contractName, signerAddress) {
  const deployment = await deployments.getOrNull(contractName);
  const implementation = await deployments.getOrNull(contractName + "_Implementation");
  const abi = implementation ? implementation.abi : deployment.abi
  let signer = undefined;
  if (signerAddress && typeof(signerAddress) === "string") {
    const signers = await ethers.getSigners();
    signer = signers.find(signer => signer._address === signerAddress);
  } else if (signerAddress && typeof(signerAddres) === "object") {
    signer = signerAddress;
  }
  return await ethers.getContractAt(abi, deployment.address, signer);
}

module.exports = {
  CHAIN_MAPPING: CHAIN_MAPPING,
  ROPSTEN_USDC_ADDRESS: ROPSTEN_USDC_ADDRESS,
  LOCAL: LOCAL,
  MAINNET: MAINNET,
  USDCDecimals: USDCDecimals,
  MAX_UINT: MAX_UINT,
  ETHDecimals: ETHDecimals,
  getMultisigAddress: getMultisigAddress,
  getUSDCAddress: getUSDCAddress,
  upgrade: upgrade,
  getDeployedContract: getDeployedContract,
}