/* global web3 */
const hre = require("hardhat")
const {
  getUSDCAddress,
  MAINNET_ONE_SPLIT_ADDRESS,
  isMainnetForking,
  getSignerForAddress,
  getDeployedContract,
  interestAprAsBN,
} = require("../blockchain_scripts/deployHelpers")
const {CONFIG_KEYS} = require("../blockchain_scripts/configKeys")
const {time} = require("@openzeppelin/test-helpers")
const {deployments, ethers, artifacts} = hre
const Borrower = artifacts.require("Borrower")
const IOneSplit = artifacts.require("IOneSplit")
const {
  createCreditLine,
  expect,
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
  ZERO_ADDRESS,
  decimals,
  USDC_DECIMALS,
} = require("./testHelpers")

const TEST_TIMEOUT = 180000 // 3 mins
const USDC_WHALE = "0x46aBbc9fc9d8E749746B00865BC2Cf7C4d85C837"
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
  let accounts, owner, bwr, person3, pool, reserve, underwriter, usdc, creditDesk, fidu, goldfinchConfig
  let goldfinchFactory, busd, usdt, cUSDC
  const busdAddress = "0x4fabb145d64652a948d72533023f6e7a623c7c53"
  const usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  const cUSDCContractAddress = "0x39aa39c021dfbae8fac545936693ac917d5e7563"
  const setupTest = deployments.createFixture(async ({deployments}) => {
    await deployments.fixture("base_deploy")
    const pool = await getDeployedAsTruffleContract(deployments, "Pool")
    const usdcAddress = getUSDCAddress("mainnet")
    const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)
    const creditDesk = await getDeployedAsTruffleContract(deployments, "CreditDesk")
    const fidu = await getDeployedAsTruffleContract(deployments, "Fidu")
    const goldfinchConfig = await getDeployedAsTruffleContract(deployments, "GoldfinchConfig")
    const goldfinchFactory = await getDeployedAsTruffleContract(deployments, "CreditLineFactory")
    const cUSDC = await artifacts.require("ICUSDCContract").at(cUSDCContractAddress)

    // Unlocks a random account that owns tons of USDC, which we can send to our test users
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE],
    })
    // Give USDC from the whale to our test accounts
    await erc20Transfer(usdc, [owner, bwr, person3], usdcVal(100000), USDC_WHALE)

    // Approve transfers from the Pool for our test accounts
    await erc20Approve(usdc, pool.address, usdcVal(100000), [owner, bwr, person3])

    await pool.deposit(usdcVal(100), {from: bwr})

    // Set the reserve to a separate address for easier separation. The current owner account gets used for many things in tests.
    await goldfinchConfig.setTreasuryReserve(reserve)
    await goldfinchConfig.setAddressForTest(CONFIG_KEYS.CUSDCContract, cUSDCContractAddress)
    await creditDesk.setUnderwriterGovernanceLimit(underwriter, usdcVal(100000), {from: owner})

    return {pool, usdc, creditDesk, fidu, goldfinchConfig, goldfinchFactory, cUSDC}
  })

  beforeEach(async function () {
    accounts = await web3.eth.getAccounts()
    ;[owner, bwr, person3, underwriter, reserve] = accounts
    ;({usdc, creditDesk, goldfinchFactory, pool, fidu, goldfinchConfig, cUSDC} = await setupTest())

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

  describe("drawing down into another currency", async function () {
    let bwrCon, cl, oneSplit
    beforeEach(async function () {
      oneSplit = await IOneSplit.at(MAINNET_ONE_SPLIT_ADDRESS)
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)

      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    })

    it("should let you drawdown to tether", async function () {
      let usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          cl.address,
          usdcAmount,
          person3,
          usdtAddress,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(bwrCon.address, usdt), {by: new BN(0)}],
        [async () => await getBalance(person3, usdt), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(bwr, usdt), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    it("should respect normal behavior of the addressToSendTo", async function () {
      let usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, usdt.address, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          cl.address,
          usdcAmount,
          ZERO_ADDRESS,
          usdtAddress,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(bwrCon.address, usdt), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(person3, usdt), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    it("should let you drawdown to BUSD", async function () {
      let usdcAmount = usdcVal(10)
      const expectedReturn = await oneSplit.getExpectedReturn(usdc.address, busdAddress, usdcAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.drawdownWithSwapOnOneInch(
          cl.address,
          usdcAmount,
          person3,
          busdAddress,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(pool.address, usdc), {by: usdcAmount.neg()}],
        [async () => await getBalance(person3, busd), {byCloseTo: expectedReturn.returnAmount}],
        [async () => await getBalance(bwr, busd), {by: new BN(0)}],
        [async () => await getBalance(bwrCon.address, busd), {by: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)
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
      // USDT has the same decimals as USDC, so USDC val is fine here.
      let rawAmount = 10
      let usdtAmount = usdcVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(usdt.address, usdc.address, usdtAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
          cl.address,
          usdtAmount,
          usdtAddress,
          expectedReturn.returnAmount.mul(new BN(99)).div(new BN(100)),
          expectedReturn.distribution,
          {from: bwr}
        )
      }).toChange([
        [async () => await getBalance(bwr, usdt), {by: usdtAmount.neg()}],
        [async () => await getBalance(cl.address, usdc), {byCloseTo: expectedReturn.returnAmount}],
      ])
      await advanceTime(creditDesk, {toBlock: (await cl.nextDueBlock()).add(new BN(1))})
      await expectAction(() => creditDesk.assessCreditLine(cl.address)).toChange([
        [async () => await cl.balance(), {decrease: true}],
        [async () => await getBalance(cl.address, usdc), {to: new BN(0)}],
      ])
    }).timeout(TEST_TIMEOUT)

    it("Works with BUSD", async () => {
      let rawAmount = 10
      let busdAmount = bigVal(rawAmount)
      const expectedReturn = await oneSplit.getExpectedReturn(busd.address, usdc.address, busdAmount, 10, 0, {
        from: bwr,
      })
      await expectAction(() => {
        return bwrCon.payWithSwapOnOneInch(
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
    }).timeout(TEST_TIMEOUT)
  })

  describe("compound integration", async () => {
    let bwrCon, cl, reserveAddress
    beforeEach(async function () {
      const result = await goldfinchFactory.createBorrower(bwr)
      let bwrConAddr = result.logs[result.logs.length - 1].args.borrower
      bwrCon = await Borrower.at(bwrConAddr)
      reserveAddress = await goldfinchConfig.getAddress(CONFIG_KEYS.TreasuryReserve)

      cl = await createCreditLine({creditDesk, borrower: bwrCon.address, underwriter})
    })

    it("should redeem from compound and recognize interest on drawdown", async function () {
      let usdcAmount = usdcVal(10)

      await expectAction(() => {
        return pool.sweepToCompound({from: owner})
      }).toChange([
        [() => getBalance(pool.address, usdc), {to: new BN(0)}], // The pool balance is swept to compound
        [() => getBalance(pool.address, cUSDC), {increase: true}], // Pool should gain some cTokens
        [() => pool.assets(), {by: new BN(0)}], // Pool's assets should not change (it should include amount on compound)
      ])

      const originalSharePrice = await pool.sharePrice()

      const BLOCKS_TO_MINE = 10
      await time.advanceBlockTo((await time.latestBlock()).add(new BN(BLOCKS_TO_MINE)))

      let originalReserveBalance = await getBalance(reserveAddress, usdc)

      await expectAction(() => {
        return bwrCon.drawdown(cl.address, usdcAmount, bwr, {from: bwr})
      }).toChange([
        [() => getBalance(pool.address, usdc), {byCloseTo: usdcVal(90)}], // regained usdc
        [() => getBalance(pool.address, cUSDC), {to: new BN(0)}], // No more cTokens
        [() => getBalance(bwr, usdc), {by: usdcAmount}], // borrower drew down the balance
      ])

      // Pool originally had 100, 10 was drawndown, we expect 90 to remain, but it's going to be slightly more due
      // to interest collected
      let poolBalanceChange = (await getBalance(pool.address, usdc)).sub(usdcVal(90))
      let reserveBalanceChange = (await getBalance(reserveAddress, usdc)).sub(originalReserveBalance)
      const interestGained = poolBalanceChange.add(reserveBalanceChange)
      expect(interestGained).to.bignumber.gt(new BN(0))

      const newSharePrice = await pool.sharePrice()

      const FEE_DENOMINATOR = new BN(10)
      const expectedfeeAmount = interestGained.div(FEE_DENOMINATOR)

      // This could be zero, if the mainnet Compound interest rate is too low, if this test fails in the future,
      // consider increasing BLOCKS_TO_MINE (but it could slow down the test)
      expect(expectedfeeAmount).to.bignumber.gt(new BN(0))
      expect(await getBalance(reserveAddress, usdc)).to.bignumber.eq(originalReserveBalance.add(expectedfeeAmount))

      const expectedSharePrice = new BN(interestGained)
        .sub(expectedfeeAmount)
        .mul(decimals.div(USDC_DECIMALS)) // This part is our "normalization" between USDC and Fidu
        .mul(decimals)
        .div(await fidu.totalSupply())
        .add(originalSharePrice)

      expect(newSharePrice).to.bignumber.gt(originalSharePrice)
      expect(newSharePrice).to.bignumber.equal(expectedSharePrice)
    }).timeout(TEST_TIMEOUT)

    it("should redeem from compound and recognize interest on withdraw", async function () {
      let usdcAmount = usdcVal(100)
      await expectAction(() => {
        return pool.sweepToCompound({from: owner})
      }).toChange([
        [() => getBalance(pool.address, usdc), {to: new BN(0)}],
        [() => getBalance(pool.address, cUSDC), {increase: true}],
        [() => pool.assets(), {by: new BN(0)}],
      ])

      const WITHDRAWL_FEE_DENOMINATOR = new BN(200)
      const expectedWithdrawAmount = usdcAmount.sub(usdcAmount.div(WITHDRAWL_FEE_DENOMINATOR))
      await expectAction(() => {
        return pool.withdraw(usdcAmount, {from: bwr})
      }).toChange([
        [() => getBalance(pool.address, usdc), {increase: true}], // USDC withdrawn, but interest was collected
        [() => getBalance(pool.address, cUSDC), {to: new BN(0)}], // No more cTokens
        [() => getBalance(bwr, usdc), {by: expectedWithdrawAmount}], // borrower drew down the full balance minus withdraw fee
        [() => pool.sharePrice(), {increase: true}], // Due to interest collected, the exact math is tested above
      ])
    }).timeout(TEST_TIMEOUT)

    it("does not allow sweeping to compound when there is already a balance", async () => {
      await pool.sweepToCompound({from: owner})

      await expect(pool.sweepToCompound({from: owner})).to.be.rejectedWith(/Cannot sweep/)
    }).timeout(TEST_TIMEOUT)

    it("can only be swept by the owner", async () => {
      await expect(pool.sweepToCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
      await expect(pool.sweepFromCompound({from: bwr})).to.be.rejectedWith(/Must have admin role/)
    }).timeout(TEST_TIMEOUT)
  })
})

// Note: These tests use ethers contracts instead of the truffle contracts.
describe("mainnet upgrade tests", async function () {
  if (!isMainnetForking()) {
    return
  }
  let owner, bwr, mainnetMultisig, mainnetConfig, usdcTruffleContract
  const CONTRACTS = ["CreditDesk", "Pool", "Fidu", "CreditLineFactory"]

  beforeEach(async function () {
    await deployments.fixture()
    ;[owner, bwr] = await web3.eth.getAccounts()
    const usdcAddress = getUSDCAddress("mainnet")
    usdcTruffleContract = await artifacts.require("IERC20withDec").at(usdcAddress)

    let deploymentsFile = require("../client/config/deployments.json")
    mainnetConfig = deploymentsFile["1"].mainnet.contracts
    mainnetMultisig = "0xBEb28978B2c755155f20fd3d09Cb37e300A6981f"

    // Ensure the multisig has funds for upgrades and other transactions
    let ownerAccount = await getSignerForAddress(owner)
    await ownerAccount.sendTransaction({to: mainnetMultisig, value: ethers.utils.parseEther("5.0")})

    // Unlocks a random account that owns tons of USDC, which we can send to our test users
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE],
    })
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [mainnetMultisig],
    })

    // Give USDC from the whale to our test accounts
    await erc20Transfer(usdcTruffleContract, [owner, bwr], usdcVal(100000), USDC_WHALE)
  })

  async function getProxyImplAddress(proxyContract) {
    const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    let currentImpl = await ethers.provider.getStorageAt(proxyContract.address, implStorageLocation)
    return ethers.utils.hexStripZeros(currentImpl)
  }

  async function upgradeContracts(contractNames, contracts) {
    const configOptionsDeployResult = await deployments.deploy("ConfigOptions", {from: owner, gas: 4000000, args: []})
    const accountantDeployResult = await deployments.deploy("Accountant", {from: owner, gas: 4000000, args: []})
    const dependencies = {
      GoldfinchConfig: {["ConfigOptions"]: configOptionsDeployResult.address},
      CreditDesk: {["Accountant"]: accountantDeployResult.address},
    }

    let mainnetMultisigSigner = await ethers.provider.getSigner(mainnetMultisig)
    for (let i = 0; i < contractNames.length; i++) {
      const contractName = contractNames[i]
      let contract = contracts[contractName]

      let deployResult = await deployments.deploy(contractName, {
        from: owner,
        gas: 4000000,
        args: [],
        libraries: dependencies[contractName],
      })
      await contract.ProxyContract.changeImplementation(deployResult.address, "0x")
      // Get the new implmentation contract with the latest ABI, but attach it to the mainnet proxy address
      let upgradedContract = await getDeployedContract(deployments, contractName, mainnetMultisigSigner)
      upgradedContract = upgradedContract.attach(contract.ProxyContract.address)
      contract.UpgradedContract = upgradedContract
      contract.UpgradedImplAddress = await getProxyImplAddress(contract.ProxyContract)
    }
    return contracts
  }

  async function getExistingContracts(contractNames) {
    let mainnetMultisigSigner = await ethers.provider.getSigner(mainnetMultisig)
    let contracts = {}
    for (let i = 0; i < contractNames.length; i++) {
      const contractName = contractNames[i]
      const contractConfig = mainnetConfig[contractName]
      const proxyConfig = mainnetConfig[`${contractName}_Proxy`]
      let contractProxy = await ethers.getContractAt(proxyConfig.abi, proxyConfig.address, mainnetMultisigSigner)
      let contract = await ethers.getContractAt(contractConfig.abi, contractConfig.address, mainnetMultisigSigner)
      contracts[contractName] = {
        ProxyContract: contractProxy,
        ExistingContract: contract,
        ExistingImplAddress: await getProxyImplAddress(contractProxy),
      }
    }
    return contracts
  }

  it("does not affect the storage layout", async () => {
    let contracts = await getExistingContracts(CONTRACTS)

    let existingSharePrice = await contracts.Pool.ExistingContract.sharePrice()
    let existingLoansOutstanding = await contracts.CreditDesk.ExistingContract.totalLoansOutstanding()

    expect(existingSharePrice.isZero()).to.be.false
    expect(existingLoansOutstanding.isZero()).to.be.false

    contracts = await upgradeContracts(CONTRACTS, contracts)

    const newSharePrice = await contracts.Pool.UpgradedContract.sharePrice()
    expect(contracts.Pool.ExistingImplAddress).to.not.eq(contracts.Pool.UpgradedImplAddress)
    expect(existingSharePrice.toString()).to.eq(newSharePrice.toString())

    let newLoansOutstanding = await contracts.CreditDesk.UpgradedContract.totalLoansOutstanding()
    expect(existingLoansOutstanding.toString()).to.eq(newLoansOutstanding.toString())
  })

  it("supports basic credit desk functions", async () => {
    let contracts = await getExistingContracts(CONTRACTS)
    let bwrSigner = await ethers.provider.getSigner(bwr)
    let bwrCreditDesk = contracts.CreditDesk.ExistingContract.connect(bwrSigner)
    let bwrPool = contracts.Pool.ExistingContract.connect(bwrSigner)
    let bwrFidu = contracts.Fidu.ExistingContract.connect(bwrSigner)

    const limit = usdcVal(1000).toString()
    const interest = interestAprAsBN("10.0").toString()
    await contracts.CreditDesk.ExistingContract.setUnderwriterGovernanceLimit(mainnetMultisig, usdcVal(1000).toString())
    let res = await (
      await contracts.CreditDesk.ExistingContract.createCreditLine(bwr, limit, interest, "360", "30", "0")
    ).wait()
    let clAddress = res.events.find((e) => e.event === "CreditLineCreated").args.creditLine
    // Signer doesn't really matter for the creditline, since it's all reads
    let clContract = await ethers.getContractAt(mainnetConfig.CreditLine.abi, clAddress, bwrSigner)
    expect((await clContract.balance()).isZero()).to.be.true

    await erc20Approve(usdcTruffleContract, contracts.Pool.ExistingContract.address, usdcVal(100000), [bwr])

    let fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.true

    await bwrPool.deposit(usdcVal(100).toString())
    fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.false

    await bwrCreditDesk.drawdown(usdcVal(500).toString(), clAddress, bwr)

    expect((await clContract.balance()).isZero()).to.be.false

    contracts = await upgradeContracts(CONTRACTS, contracts)

    bwrCreditDesk = contracts.CreditDesk.UpgradedContract.connect(bwrSigner)
    bwrPool = contracts.Pool.UpgradedContract.connect(bwrSigner)

    // Pay off in full
    await bwrCreditDesk.pay(clAddress, usdcVal(501).toString())
    await bwrCreditDesk.applyPayment(clAddress, usdcVal(501).toString())

    expect((await clContract.balance()).isZero()).to.be.true

    bwrPool.withdrawInFidu(fiduBalance.toString())
    fiduBalance = await bwrFidu.balanceOf(bwr)
    expect(fiduBalance.isZero()).to.be.true
  })
})
