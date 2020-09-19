const BN = require('bn.js');
const {ROPSTEN_USDC_ADDRESS, getUSDCAddress, USDCDecimals} = require("../blockchain_scripts/deployHelpers.js");

let logger;
async function main({ getNamedAccounts, deployments, getChainId }) {
  const { deploy, log } = deployments;
  logger = log;
  logger("Starting deploy...")
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  logger("Will be deploying using the protocol_owner account:", protocol_owner);

  const chainID = await getChainId();
  logger("Chain ID is:", chainID);
  const pool = await deployPool(deploy, protocol_owner, proxy_owner, chainID);
  const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []});
  logger("Accountant was deployed to:", accountant.address);

  var creditDeskDeployResult = await deploy("CreditDesk", {from: protocol_owner, proxy: {owner: proxy_owner, methodName: "initialize"}, gas: 4000000, args: [pool.address],libraries: {["Accountant"]: accountant.address}});
  logger("Credit Desk was deployed to:", creditDeskDeployResult.address);
  const creditDesk = await ethers.getContractAt(creditDeskDeployResult.abi, creditDeskDeployResult.address);

  await ensurePoolIsOnCreditDesk(creditDesk, pool.address);
  await transferOwnershipOfPoolToCreditDesk(pool, creditDesk.address);
};

async function deployPool(deploy, protocol_owner, proxy_owner, chainID) {
  const poolDeployResult = await deploy("Pool", {from: protocol_owner, proxy: {owner: proxy_owner}, gas: 4000000, args: []});
  logger("Pool was deployed to:", poolDeployResult.address);
  const pool = await ethers.getContractAt("Pool", poolDeployResult.address);
  const erc20Address = await pool.erc20address();

  // This is testing if the erc20 address of the pool is the zero address, ie. has not been set.
  const isInitialized = !/^0x0+$/.test(erc20Address);
  if (!isInitialized) {
    let usdcAddress = getUSDCAddress(chainID);
    if (!usdcAddress) {
      logger("We don't have a USDC address for this network, so deploying a fake USDC");
      const initialAmount = String(new BN("1000000").mul(USDCDecimals));
      const decimalPlaces = String(new BN(6));
      const fakeUSDC = await deploy("TestERC20", {from: protocol_owner, gas: 4000000, args: [initialAmount, decimalPlaces]});
      logger("Deployed the contract to:", fakeUSDC.address);
      usdcAddress = fakeUSDC.address;
    }
    logger("Initializing the pool...", String(USDCDecimals));
    var receipt = await pool.initialize(usdcAddress, "USDC", String(USDCDecimals));
    await receipt.wait();
    logger("Share price after initialization is:", String(await pool.sharePrice()));
  }
  return pool;
}

async function ensurePoolIsOnCreditDesk(creditDesk, poolAddress) {
  logger("Checking that", poolAddress, "is correctly set on the credit desk");
  const creditDeskPoolAddress = await creditDesk.poolAddress();
  if (poolAddress != creditDeskPoolAddress) {
    throw new Error(`Expected pool address was ${poolAddress}, but got ${newPoolAddress}`);
  }
}

async function transferOwnershipOfPoolToCreditDesk(pool, creditDeskAddress) {
  const originalOwner = await pool.owner();
  logger("Pool owner is:", originalOwner);
  if (originalOwner === creditDeskAddress) {
    // We already did this step, so early return
    logger("Looks like Credit Desk already is the owner");
    return
  }
  logger("Transferring ownership of the pool to the Credit Desk");
  const txn = await pool.transferOwnership(creditDeskAddress);
  await txn.wait();
  const newOwner = await pool.owner();
  if (newOwner != creditDeskAddress) {
    throw new Error(`Expected new owner ${newOwner} to equal ${creditDeskAddress}`);
  }
}

module.exports = main;
module.exports.tags = ["base_deploy"];