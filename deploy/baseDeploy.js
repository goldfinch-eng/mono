const BN = require('bn.js');
const {ROPSTEN_USDC_ADDRESS, getUSDCAddress, USDCDecimals} = require("../blockchain_scripts/deployHelpers.js");

async function main({ getNamedAccounts, deployments, getChainId }) {
  console.log("Starting deploy...")
  const { deploy } = deployments;
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  console.log("Will be deploying using the protocol_owner account:", protocol_owner);

  const chainID = await getChainId();
  console.log("Chain ID is:", chainID);
  const pool = await deployPool(deploy, protocol_owner, proxy_owner, chainID);
  const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []});
  console.log("Accountant was deployed to:", accountant.address);

  var creditDeskDeployResult = await deploy("CreditDesk", {from: protocol_owner, proxy: {owner: proxy_owner, methodName: "initialize"}, gas: 4000000, args: [pool.address],libraries: {["Accountant"]: accountant.address}});
  console.log("default signer is...", (await ethers.getSigners())[0]._address);
  console.log("Credit Desk was deployed to:", creditDeskDeployResult.address);
  const creditDesk = await ethers.getContractAt(creditDeskDeployResult.abi, creditDeskDeployResult.address);

  await ensurePoolIsOnCreditDesk(creditDesk, pool.address);
  await transferOwnershipOfPoolToCreditDesk(pool, creditDesk.address);
};

async function deployPool(deploy, protocol_owner, proxy_owner, chainID) {
  const poolDeployResult = await deploy("Pool", {from: protocol_owner, proxy: {owner: proxy_owner}, gas: 4000000, args: []});
  console.log("Pool was deployed to:", poolDeployResult.address);
  const pool = await ethers.getContractAt("Pool", poolDeployResult.address);
  const erc20Address = await pool.erc20address();

  // This is testing if the erc20 address of the pool is the zero address, ie. has not been set.
  const isInitialized = !/^0x0+$/.test(erc20Address);
  if (!isInitialized) {
    let usdcAddress = getUSDCAddress(chainID);
    if (!usdcAddress) {
      console.log("We don't have a USDC address for this network, so deploying a fake USDC");
      const initialAmount = String(new BN("1000000").mul(USDCDecimals));
      const decimalPlaces = String(new BN(6));
      const fakeUSDC = await deploy("TestERC20", {from: protocol_owner, gas: 4000000, args: [initialAmount, decimalPlaces]});
      console.log("Deployed the contract to:", fakeUSDC.address);
      usdcAddress = fakeUSDC.address;
    }
    console.log("Initializing the pool...", String(USDCDecimals));
    var receipt = await pool.initialize(usdcAddress, "USDC", String(USDCDecimals));
    await receipt.wait();
    console.log("Share price after initialization is:", String(await pool.sharePrice()));
  }
  return pool;
}

async function ensurePoolIsOnCreditDesk(creditDesk, poolAddress) {
  console.log("Checking that", poolAddress, "is correctly set on the credit desk");
  const creditDeskPoolAddress = await creditDesk.poolAddress();
  if (poolAddress != creditDeskPoolAddress) {
    throw new Error(`Expected pool address was ${poolAddress}, but got ${newPoolAddress}`);
  }
}

async function transferOwnershipOfPoolToCreditDesk(pool, creditDeskAddress) {
  const originalOwner = await pool.owner();
  console.log("Pool owner is:", originalOwner);
  if (originalOwner === creditDeskAddress) {
    // We already did this step, so early return
    console.log("Looks like Credit Desk already is the owner");
    return
  }
  console.log("Transferring ownership of the pool to the Credit Desk");
  const txn = await pool.transferOwnership(creditDeskAddress);
  await txn.wait();
  const newOwner = await pool.owner();
  if (newOwner != creditDeskAddress) {
    throw new Error(`Expected new owner ${newOwner} to equal ${creditDeskAddress}`);
  }
}

module.exports = main;
module.exports.tags = ["base_deploy"];