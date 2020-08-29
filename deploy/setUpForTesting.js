const BN = require('bn.js');
const {ROPSTEN_USDC_ADDRESS, MAINNET, decimals, MAX_UINT} = require("../deployHelpers.js");

/*
This does a basic deploy of just the main contracts, as well as a few
housekeeping things like transferring ownership of the Pool to the CreditDesk.

That's it! For other stuff, like creating credit lines and such, it's in a separate
script made just for that purpose.
*/

async function main({ getNamedAccounts, deployments }) {
  console.log("Running the setup for testing script!")
  const { getOrNull } = deployments;
  const { admin } = await getNamedAccounts();
  const pool = await getDeployedAsEthersContract(getOrNull, "Pool");
  const creditDesk = await getDeployedAsEthersContract(getOrNull, "CreditDesk");
  let erc20 = await getDeployedAsEthersContract(getOrNull, "TestERC20");
  if (!erc20) {
    console.log("No ERC20 deployed locally, so firing up the Ropsten one...")
    erc20 = await ethers.getContractAt("TestERC20", ROPSTEN_USDC_ADDRESS);
  }
  await depositFundsToThePool(pool, admin, erc20);
  await createUnderwriter(creditDesk, admin);
  await createCreditLineForBorrower(creditDesk, admin);
};

async function depositFundsToThePool(pool, admin, erc20) {
  console.log("Depositing funds into the pool...");
  const originalBalance = await erc20.balanceOf(pool.address)
  if (originalBalance.gt(new BN(0))) {
    console.log(`Looks like the pool already has ${originalBalance} of funds...`);
    return;
  }

  // We don't have mad bank for testnet USDC, so divide by 10.
  const depositAmount = new BN(1).mul(decimals).div(new BN(10));
  const erc20Result = await erc20.approve(pool.address, String(MAX_UINT));
  const result = await pool.deposit(String(depositAmount));
  const newBalance = await erc20.balanceOf(pool.address)
  if (String(newBalance) != String(depositAmount)) {
    throw new Error(`Expected to deposit ${depositAmount} but got ${newBalance}`);
  }
}

async function getDeployedAsEthersContract(getter, name) {
  console.log("Trying to get the deployed version...")
  const deployed = await getter(name);
  if (!deployed) {
    return null;
  }
  return await ethers.getContractAt(deployed.abi, deployed.address);
}

async function createUnderwriter(creditDesk, newUnderwriter) {
  console.log("Trying to create an Underwriter...");
  const alreadyUnderwriter = await creditDesk.underwriters(newUnderwriter)
  if (alreadyUnderwriter.gt(new BN(0))) {
    console.log("We have already created this address as an underwriter");
    return;
  }
  console.log("Creating an underwriter with governance limit", newUnderwriter);
  await creditDesk.setUnderwriterGovernanceLimit(newUnderwriter, String(new BN(1000000).mul(decimals)));
  const onChain = await creditDesk.underwriters(newUnderwriter);
  if (!onChain.gt(new BN(0))) {
    throw new Error(`The transaction did not seem to work. Could not find underwriter ${newUnderwriter} on the CreditDesk`);
  }
}

async function createCreditLineForBorrower(creditDesk, borrower) {
  console.log("Trying to create an Underwriter...");
  const existingCreditLines = await creditDesk.getBorrowerCreditLines(borrower)
  if (existingCreditLines.length) {
    console.log("We have already created a credit line for this borrower");
    return;
  }

  console.log("Creating a credit line for the borrower", borrower);
  const limit = String(new BN(123).mul(decimals));
  const interestApr = String(new BN(5));
  const minCollateralPercent = String(new BN(10));
  const paymentPeriodInDays = String(new BN(30));
  const termInDays = String(new BN(360));
  await creditDesk.createCreditLine(borrower, limit, interestApr, minCollateralPercent, paymentPeriodInDays, termInDays);
  console.log("Created a credit line for the borrower", borrower);
}

module.exports = main;
module.exports.dependencies = ["base_deploy"];
module.exports.skip = async ({getNamedAccounts, deployments, getChainId}) => {
  return (await getChainId()) === MAINNET;
};
