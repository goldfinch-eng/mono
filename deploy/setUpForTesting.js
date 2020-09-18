const BN = require('bn.js');
const {MAINNET, LOCAL, CHAIN_MAPPING, getUSDCAddress, USDCDecimals, ETHDecimals} = require("../blockchain_scripts/deployHelpers.js");

/*
This deployment deposits some funds to the pool, and creates an underwriter, and a credit line.
It is only really used for test purposes, and should never be used on Mainnet (which it automatically never does);
*/

async function main({ getNamedAccounts, deployments, getChainId }) {
  console.log("Running the setup for testing script!")
  const { getOrNull } = deployments;
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  let chainID = await getChainId();
  let underwriter = protocol_owner;
  let borrower = protocol_owner;
  const pool = await getDeployedAsEthersContract(getOrNull, "Pool");
  const creditDesk = await getDeployedAsEthersContract(getOrNull, "CreditDesk");
  let erc20 = await getDeployedAsEthersContract(getOrNull, "TestERC20");

  if (getUSDCAddress(chainID)) {
    console.log("On a network with known USDC address, so firing up that contract...")
    erc20 = await ethers.getContractAt("TestERC20", getUSDCAddress(chainID));
  }
  if (process.env.TEST_USER) {
    borrower = process.env.TEST_USER;
    if (CHAIN_MAPPING[chainID] === LOCAL) {
      await giveMoneyToTestUser(process.env.TEST_USER, erc20);
    }
  }

  await depositFundsToThePool(pool, protocol_owner, erc20);
  await createUnderwriter(creditDesk, underwriter);
  await createCreditLineForBorrower(creditDesk, borrower);
};

async function depositFundsToThePool(pool, protocol_owner, erc20) {
  console.log("Depositing funds into the pool...");
  const originalBalance = await erc20.balanceOf(pool.address)
  if (originalBalance.gt(new BN(0))) {
    console.log(`Looks like the pool already has ${originalBalance} of funds...`);
    return;
  }

  // Approve first
  console.log("Approving the owner to deposit funds...")
  var txn = await erc20.approve(pool.address, String(new BN(10000).mul(USDCDecimals)));
  await txn.wait(); 
  // We don't have mad bank for testnet USDC, so divide by 10.
  console.log("Depositing funds...")
  const depositAmount = new BN(1).mul(USDCDecimals).div(new BN(10));
  var txn = await pool.deposit(String(depositAmount));
  await txn.wait();
  const newBalance = await erc20.balanceOf(pool.address)
  if (String(newBalance) != String(depositAmount)) {
    throw new Error(`Expected to deposit ${depositAmount} but got ${newBalance}`);
  }
}

async function giveMoneyToTestUser(testUser, erc20) {
  console.log("Sending money to the test user", testUser);
  const [protocol_owner] = await ethers.getSigners();
  await protocol_owner.sendTransaction({
    to: testUser,
    value: ethers.utils.parseEther("10.0")
  });
  await erc20.transfer(testUser, String(new BN(10).mul(USDCDecimals)));
}

async function getDeployedAsEthersContract(getter, name) {
  console.log("Trying to get the deployed version of...", name);
  const deployed = await getter(name);
  if (!deployed) {
    return null;
  }
  return await ethers.getContractAt(deployed.abi, deployed.address);
}

async function createUnderwriter(creditDesk, newUnderwriter) {
  console.log("Trying to create an Underwriter...", newUnderwriter);
  const alreadyUnderwriter = await creditDesk.underwriters(newUnderwriter)
  if (alreadyUnderwriter.gt(new BN(0))) {
    console.log("We have already created this address as an underwriter");
    return;
  }
  console.log("Creating an underwriter with governance limit", newUnderwriter);
  const txn = await creditDesk.setUnderwriterGovernanceLimit(newUnderwriter, String(new BN(1000000).mul(USDCDecimals)));
  await txn.wait();
  const onChain = await creditDesk.underwriters(newUnderwriter);
  if (!onChain.gt(new BN(0))) {
    throw new Error(`The transaction did not seem to work. Could not find underwriter ${newUnderwriter} on the CreditDesk`);
  }
}

async function createCreditLineForBorrower(creditDesk, borrower) {
  console.log("Trying to create an CreditLine for the Borrower...");
  const existingCreditLines = await creditDesk.getBorrowerCreditLines(borrower)
  if (existingCreditLines.length) {
    console.log("We have already created a credit line for this borrower");
    return;
  }

  console.log("Creating a credit line for the borrower", borrower);
  const limit = String(new BN(123).mul(USDCDecimals));
  // Divide by 100, because this should be given as a percentage. ie. 100 == 100%
  const interestApr = String(new BN(5).mul(ETHDecimals).div(new BN(100)));
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
