const BN = require('bn.js');
const {getUSDCAddress, USDCDecimals, upgrade} = require("./deployHelpers.js");
const PROTOCOL_CONFIG = require('../protocol_config.json');
let logger;

async function baseDeploy(bre, {shouldUpgrade}) {
  const { deployments, getNamedAccounts, getChainId } = bre;
  const { deploy, log } = deployments;
  logger = log;
  logger("Starting deploy...")
  const { protocol_owner, proxy_owner } = await getNamedAccounts();
  logger("Will be deploying using the protocol_owner account:", protocol_owner);

  const chainID = await getChainId();
  logger("Chain ID is:", chainID);
  const pool = await deployPool(deploy, shouldUpgrade, protocol_owner, proxy_owner, chainID);
  const creditDesk = await deployCreditDesk(deploy, shouldUpgrade, pool.address, protocol_owner, proxy_owner);

  await ensurePoolIsOnCreditDesk(creditDesk, pool.address);
  await transferOwnershipOfPoolToCreditDesk(pool, creditDesk.address);

  // Internal functions.

  async function deployPool(deploy, shouldUpgrade, protocol_owner, proxy_owner, chainID) {
    let poolDeployResult
    if (shouldUpgrade) {
      poolDeployResult = await upgrade(bre, "Pool")
    } else {
      poolDeployResult = await deploy("Pool", {from: protocol_owner, proxy: {owner: proxy_owner}, gas: 4000000, args: []});
    }
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
      logger("Initializing the pool...");
      const transactionLimit = new BN(PROTOCOL_CONFIG.transactionLimit).mul(USDCDecimals);
      const totalFundsLimit = new BN(PROTOCOL_CONFIG.totalFundsLimit).mul(USDCDecimals);
      await (await pool.initialize(usdcAddress, "USDC", String(USDCDecimals))).wait();
      await (await pool.setTransactionLimit(String(transactionLimit))).wait();
      await (await pool.setTotalFundsLimit(String(totalFundsLimit))).wait();

      logger("Share price after initialization is:", String(await pool.sharePrice()));
    }
    return pool;
  }

  async function deployCreditDesk(deploy, shouldUpgrade, poolAddress, protocol_owner, proxy_owner) {
    const accountant = await deploy("Accountant", {from: protocol_owner, gas: 4000000, args: []});
    logger("Accountant was deployed to:", accountant.address);

    let creditDeskDeployResult; 
    let creditDesk;
    if (shouldUpgrade) {
      creditDeskDeployResult = await upgrade(bre, "CreditDesk", {libraries: {["Accountant"]: accountant.address}});
    } else {
      creditDeskDeployResult= await deploy("CreditDesk", {from: protocol_owner, proxy: {owner: proxy_owner, methodName: "initialize"}, gas: 4000000, args: [poolAddress], libraries: {["Accountant"]: accountant.address}});
    }
    logger("Credit Desk was deployed to:", creditDeskDeployResult.address);
    creditDesk = await ethers.getContractAt(creditDeskDeployResult.abi, creditDeskDeployResult.address);
    await creditDesk.setMaxUnderwriterLimit(String(new BN(PROTOCOL_CONFIG.maxUnderwriterLimit).mul(USDCDecimals)));
    return creditDesk;
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
}

module.exports = baseDeploy;
