const Web3 = require('web3');
const BN = require('bn.js');
const fs = require('fs');
const web3 = new Web3('http://127.0.0.1:8545');
const CreditDeskContract = require('../artifacts/CreditDesk.json');
const PoolContract = require('../artifacts/Pool.json');
const decimals = new BN(String(1e18));
const CONFIG_PATH = './client/config/protocol-local.json';
let owner;
let borrower;
let underwriter;
let capitalProvider;

// These are just a couple addresses that oz makes available on the local network.
// You can see others if you run `npx oz accounts`

async function deploy() {
  console.log("Starting deploy...");
  [borrower, owner, capitalProvider] = await web3.eth.getAccounts();

  const poolContract = new web3.eth.Contract(PoolContract.abi);
  const creditDeskContract = new web3.eth.Contract(CreditDeskContract.abi);

  const pool = await poolContract.deploy({data: PoolContract.bytecode}).send({from: owner, gasPrice: new BN('20000000000'), gas: new BN('6721975')});
  console.log("Deployed the pool");

  console.log("Deploying the creditDesk");
  const creditDesk = await creditDeskContract.deploy({data: CreditDeskContract.bytecode}).send({from: owner, gasPrice: new BN('20000000000'), gas: new BN('6721975')});
  console.log("Deployed the creditDesk");

  await setPoolOnCreditDesk(creditDesk, pool._address);
  await depositFundsToThePool(pool, capitalProvider);

  await transferOwnershipOfPoolToCreditDesk(pool, creditDesk._address);

  await createUnderwriter(creditDesk, owner);
  await createCreditLineForBorrower(creditDesk, borrower);

  const underwriterCreditLines = await creditDesk.methods.getUnderwriterCreditLines(underwriter).call();
  const borrowerCreditLines = await creditDesk.methods.getBorrowerCreditLines(borrower).call();
  if (String(underwriterCreditLines) != String(borrowerCreditLines)) {
    throw new Error(`Something went wrong. Expected underwriter credit lines ${underwriterCreditLines} to equal borrower credit lines ${borrowerCreditLines}`);
  }


  console.log("Writing addresses to client config...");
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    pool: {address: pool._address},
    creditDesk: {address: creditDesk._address},
  }))
  console.log("All done! You should have a usable environment to test things locally");
}

async function setPoolOnCreditDesk(creditDesk, poolAddress) {
  console.log("Trying to set", poolAddress, "on the credit desk");
  await creditDesk.methods.setPoolAddress(poolAddress).send({from: owner})
  const newPoolAddress = await creditDesk.methods.poolAddress().call();
  if (newPoolAddress != poolAddress) {
    throw new Error("Expected pool address was", poolAddress, "but got:", newPoolAddress);
  }
  console.log("Set the pool address", poolAddress, "on the credit desk");
}

async function transferOwnershipOfPoolToCreditDesk(pool, creditDeskAddress) {
  console.log("Transferring ownership of the pool to the Credit Desk");
  await pool.methods.transferOwnership(creditDeskAddress).send({from: owner});
  const newOwner = await pool.methods.owner().call();
  if (newOwner != creditDeskAddress) {
    throw new Error("Expected new owner", newOwner, "to equal", creditDeskAddress);
  }
}

async function createUnderwriter(creditDesk, newUnderwriter) {
  console.log("Creating an underwriter with governance limit", newUnderwriter);
  await creditDesk.methods.setUnderwriterGovernanceLimit(newUnderwriter, String(new BN(1000).mul(decimals))).send({from: owner})
  underwriter = newUnderwriter;
}

async function createCreditLineForBorrower(creditDesk, borrower) {
  console.log("Creating a credit line for the borrower", borrower);
  const limit = String(new BN(123).mul(decimals));
  const interestApr = String(new BN(5));
  const minCollateralPercent = String(new BN(10));
  const paymentPeriodInDays = String(new BN(30));
  const termInDays = String(new BN(360));
  console.log("Using", underwriter, "as the underwriter...")
  await creditDesk.methods.createCreditLine(borrower, limit, interestApr, minCollateralPercent, paymentPeriodInDays, termInDays).send({from: underwriter})
}

async function depositFundsToThePool(pool, capitalProvider) {
  const balanceBefore = await web3.eth.getBalance(pool._address);
  console.log("balance before deposit is..", String(balanceBefore));
  console.log("Depositing funds into the pool!")
  const depositAmount = String(new BN(1000).mul(decimals));
  await pool.methods.deposit().send({from: capitalProvider, value: depositAmount});
  const balance = await web3.eth.getBalance(pool._address);
  if (String(balance) != depositAmount) {
    throw new Error(`Expected to deposit ${depositAmount} but got ${balance}`);
  }
}

deploy()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });