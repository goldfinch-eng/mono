const Web3 = require('web3');
const BN = require('bn.js');
const fs = require('fs');
const web3 = new Web3('http://127.0.0.1:8545');
const CreditDeskContract = require('../artifacts/CreditDesk.json');
const PoolContract = require('../artifacts/Pool.json');
const TestERC20Contract = require('../artifacts/TestERC20.json');
const { bigVal } = require('../test/testHelpers');

// Using 1e6, because that's what USDC is.
const decimals = new BN(String(1e6));

const CONFIG_PATH = './client/config/protocol-local.json';
let owner;
let borrower;
let underwriter;
let capitalProvider;

async function deploy() {
  console.log("Starting deploy...");
  [borrower, owner, capitalProvider] = await web3.eth.getAccounts();
  if (process.env.TEST_USER_ADDRESS) {
    borrower = process.env.TEST_USER_ADDRESS;
    capitalProvider = process.env.TEST_USER_ADDRESS;
  }

  const [pool, creditDesk, erc20] = await deployContracts();

  // Give the capital provider some erc20 chedda.
  await sendTestFundsToCapitalProvider(erc20, owner, capitalProvider);

  await setPoolOnCreditDesk(creditDesk, pool._address);
  await depositFundsToThePool(pool, erc20, owner);

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
    erc20: {address: erc20._address},
  }))
  console.log("All done! You should have a usable environment to test things locally");
  console.log("**** Hey! Don't Forget... ****")
  console.log("You should add in", erc20._address, "to your Metamask tokens in order to see your fake USDC balance");
}

async function deployContracts() {
  const poolContract = new web3.eth.Contract(PoolContract.abi);
  const creditDeskContract = new web3.eth.Contract(CreditDeskContract.abi);
  const erc20Contract = new web3.eth.Contract(TestERC20Contract.abi);

  const initialAmount = new BN(100000).mul(decimals);
  const numDecimals = "6";
  const erc20 = await erc20Contract.deploy({data: TestERC20Contract.bytecode, arguments: [String(initialAmount), numDecimals]}).send({from: owner, gasPrice: new BN('20000000000'), gas: new BN('6721975')});
  console.log("Deployed the erc20 at", erc20._address);

  const pool = await poolContract.deploy({data: PoolContract.bytecode}).send({from: owner, gasPrice: new BN('20000000000'), gas: new BN('6721975')});
  await pool.methods.initialize(erc20._address, "USDC", String(decimals)).send({from: owner});
  erc20.methods.approve(pool._address, String(new BN(100000).mul(decimals))).send({from: owner});
  console.log("Deployed the pool");

  const creditDesk = await creditDeskContract.deploy({data: CreditDeskContract.bytecode}).send({from: owner, gasPrice: new BN('20000000000'), gas: new BN('6721975')});
  console.log("Deployed the creditDesk");

  return [pool, creditDesk, erc20];
}

async function sendTestFundsToCapitalProvider(erc20, owner, capitalProvider) {
  await erc20.methods.transfer(capitalProvider, String(new BN(10000).mul(decimals))).send({from: owner});
  await web3.eth.sendTransaction({from: owner, to: capitalProvider, value: new BN(String(50e18))});
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

async function depositFundsToThePool(pool, erc20, capitalProvider) {
  const depositAmount = String(new BN(1000).mul(decimals));
  console.log("Depositing", depositAmount, "into the pool!")
  await pool.methods.deposit(depositAmount).send({from: capitalProvider});
  const balance = await erc20.methods.balanceOf(pool._address).call();
  console.log("Balance is..", balance);
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