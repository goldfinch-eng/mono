const BN = require('bn.js');
const {ROPSTEN_USDC_ADDRESS, getUSDCAddress, USDCDecimals} = require("../blockchain_scripts/deployHelpers.js");

async function main({ getNamedAccounts, deployments, getChainId }) {
  console.log("Starting deploy...")
  const { deploy } = deployments;
  const { admin } = await getNamedAccounts();
  console.log("Will be deploying using the admin account:", admin);

  const chainID = await getChainId();
  console.log("Chain ID is:", chainID);
  const pool = await deployPool(deploy, admin, chainID);
  const accountant = await deploy("Accountant", {from: admin, gas: 4000000, args: []});
  console.log("Accountant was deployed to:", accountant.address);

  var creditDeskDeployResult = await deploy("CreditDesk", {from: admin, gas: 4000000, args: [],libraries: {["Accountant"]: accountant.address}});
  console.log("Credit Desk was deployed to:", creditDeskDeployResult.address);
  const creditDesk = await ethers.getContractAt(creditDeskDeployResult.abi, creditDeskDeployResult.address);

  await setPoolOnCreditDesk(creditDesk, pool.address);
  await transferOwnershipOfPoolToCreditDesk(pool, creditDesk.address);
};

async function deployPool(deploy, admin, chainID) {
  const poolDeployResult = await deploy("Pool", {from: admin, gas: 4000000, args: []});
  console.log("Pool was deployed to:", poolDeployResult.address);
  const pool = await ethers.getContractAt("Pool", poolDeployResult.address);
  const isInitialized = !!(await pool.erc20address());
  if (!isInitialized) {
    let usdcAddress = getUSDCAddress(chainID);
    if (!usdcAddress) {
      console.log("We don't have a USDC address for this network, so deploying a fake USDC");
      const initialAmount = String(new BN("1000000").mul(USDCDecimals));
      const decimalPlaces = String(new BN(6));
      const fakeUSDC = await deploy("TestERC20", {from: admin, gas: 4000000, args: [initialAmount, decimalPlaces]});
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

async function setPoolOnCreditDesk(creditDesk, poolAddress) {
  const originalPoolAddress = await creditDesk.poolAddress();
  if (originalPoolAddress === poolAddress) {
    console.log("Pool is already set correctly")
    return;
  }
  console.log("Trying to set", poolAddress, "on the credit desk");
  var result = await creditDesk.setPoolAddress(poolAddress);
  await result.wait();
  const newPoolAddress = await creditDesk.poolAddress();
  if (newPoolAddress != poolAddress) {
    throw new Error(`Expected pool address was ${poolAddress}, but got ${newPoolAddress}`);
  }
  console.log("Set the pool address", poolAddress, "on the credit desk");
}

async function transferOwnershipOfPoolToCreditDesk(pool, creditDeskAddress) {
  const originalOwner = await pool.owner();
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