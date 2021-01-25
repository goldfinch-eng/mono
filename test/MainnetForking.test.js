/* global web3 */
const hre = require("hardhat")
const {artifacts} = hre
const {getUSDCAddress, MAINNET_ONE_SPLIT_ADDRESS, isMainnetForking} = require("../blockchain_scripts/deployHelpers")
const {deployments} = hre
const Borrower = artifacts.require("Borrower")
const IOneSplit = artifacts.require("IOneSplit")
const {
  createCreditLine,
  expectAction,
  getDeployedAsTruffleContract,
  erc20Transfer,
  erc20Approve,
  usdcVal,
  getBalance,
  MAX_UINT,
  bigVal,
  advanceTime,
  BN,
} = require("./testHelpers")
/*
These tests are special. They use existing mainnet state, so
that we can easily and realistically test interactions with outside protocols
and contracts.
*/
describe("mainnet forking tests", async function () {
  // Hack way to only run this suite when we actually want to.
  if (!isMainnetForking()) {
    return
  }
  let accounts, owner, bwr, person3, reserve, underwriter, usdc, creditDesk
  let goldfinchFactory, busd, usdt
  const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
  const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  const setupTest = deployments.createFixture(async ({deployments}) => {
    await deployments.fixture("base_deploy")
    const pool = await getDeployedAsTruffleContract(deployments, "Pool")
    const usdcAddress = getUSDCAddress("mainnet")
    const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
    const creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
    const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
    const goldfinchFactory = await getDeployedAsTruffleContract(deployments, "CreditLineFactory")

    const usdcWhale = "0x46aBbc9fc9d8E749746B00865BC2Cf7C4d85C837"
    // Unlocks a random account that owns tons of USDC, which we can send to our test users
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhale],
    })
    // Give USDC from the whale to our test accounts
    await erc20Transfer(usdc, [owner, bwr, person3], usdcVal(100000), usdcWhale)

    // Approve transfers from the Pool for our test accounts
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, bwr, person3])

    await pool.deposit(usdcVal(100), {from: bwr})

    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(100000), {from: owner})

    return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory}
  })

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3, underwriter, reserve] = accounts
    ;({usdc, creditDesk, goldfinchFactory} = await setupTest())

    // Give BUSD from the whale to our test accounts
    const busdWhale = "0x81670C129A9cf4FD535Cc68aE8b4a0df56d1BB82"
    const usdtWhale = "0x0d40c5e36100a60680b51a80ce9ba3653abc1498"
    // Unlocks a random account that owns tons of BUSD, which we can send to our test users
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [busdWhale],
    })
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdtWhale],
    })

    busd = await artifacts.require("IERC20withDec").at(busdAddress)
    usdt = await artifacts.require("IERC20withDec").at(usdtAddress)
    await erc20Transfer(busd, [owner, bwr, person3], bigVal(100000), busdWhale)
    await erc20Transfer(usdt, [owner, bwr, person3], usdcVal(100000), usdtWhale)
  })

  describe("paying back via another currency", async function () {
    let bwrCon, cl, oneSplit
    let amount = usdcVal(100)
    beforeEach(async function () {
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      await erc20Approve(busd, bwrCon.address, MAX_UINT, [bwr])
      await erc20Approve(usdt, bwrCon.address, MAX_UINT, [bwr])

      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
      await bwrCon.drawdown(cl.address, amount, bwr, {from: bwr})
    })

    it("should allow you to pay with another currency", async () => {
      let rawAmount = 10
      const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, usdcVal(rawAmount), 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapThroughOneInch(
          cl.address,
          usdcVal(rawAmount),
          usdtAddress,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(bwr, usdt), {by: usdcVal(rawAmount).neg()}],
        [async () => await getBalance(cl.address, usdc), {byCloseTo: expectedReturn.returnAmount}],
      ])
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(180000)
    it("Works with BUSD", async () => {
      let rawAmount = 10
      let busdAmount = bigVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(busd.address, usdc.address, busdAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapThroughOneInch(
          cl.address,
          busdAmount,
          busdAddress,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(bwr, busd), {by: busdAmount.neg()}],
        [async () => await getBalance(cl.address, usdc), {byCloseTo: expectedReturn.returnAmount}],
      ])
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(180000)
  })
})
