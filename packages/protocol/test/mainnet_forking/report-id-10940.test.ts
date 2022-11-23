import hre from "hardhat"
import {
  CreditLineInstance,
  ERC20Instance,
  FiduInstance,
  GoInstance,
  GoldfinchConfigInstance,
  SeniorPoolInstance,
  TranchedPoolInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {expect, BN, advanceTime, usdcVal} from "../testHelpers"
import {
  ContractDeployer,
  ContractUpgrader,
  getERC20Address,
  getProtocolOwner,
  getTruffleContract,
  MAINNET_CHAIN_ID,
} from "../../blockchain_scripts/deployHelpers"
import {UpgradedContracts} from "../../blockchain_scripts/deployHelpers/upgradeContracts"
import {
  changeImplementations,
  getDeployEffects,
} from "@goldfinch-eng/protocol/blockchain_scripts/migrations/deployEffects"
import {impersonateAccount} from "../../blockchain_scripts/helpers/impersonateAccount"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {CONFIG_KEYS} from "@goldfinch-eng/protocol/blockchain_scripts/configKeys"
import {TEST_TIMEOUT} from "./MainnetForking.test"
import {assertNonNullable} from "@goldfinch-eng/utils"

const setupTest = hre.deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("baseDeploy", {keepExistingDeployments: true})

  let upgradedContracts: UpgradedContracts
  {
    const deployEffects = await getDeployEffects({
      title: "Test SeniorPool for report ID 10940",
    })

    const deployer = new ContractDeployer(console.log, hre)
    const upgrader = new ContractUpgrader(deployer)

    upgradedContracts = await upgrader.upgrade({
      contracts: ["SeniorPool"],
    })

    deployEffects.add(
      await changeImplementations({
        contracts: upgradedContracts,
      })
    )

    await deployEffects.executeDeferred()
  }

  return {
    go: await getTruffleContract<GoInstance>("Go"),
    config: await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig"),
    fidu: await getTruffleContract<FiduInstance>("Fidu"),
    usdc: await getTruffleContract<ERC20Instance>("ERC20", {at: getERC20Address("USDC", MAINNET_CHAIN_ID)}),
    seniorPool: await getTruffleContract<SeniorPoolInstance>("SeniorPool"),
  }
})

describe.skip("Report ID 10940", async function () {
  this.timeout(TEST_TIMEOUT)

  let go: GoInstance,
    legacyConfig: GoldfinchConfigInstance,
    config: GoldfinchConfigInstance,
    fidu: FiduInstance,
    seniorPool: SeniorPoolInstance,
    usdc: ERC20Instance

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({go, config, fidu, seniorPool, usdc} = await setupTest())
    legacyConfig = await getTruffleContract<GoldfinchConfigInstance>("GoldfinchConfig", {at: await go.legacyGoList()})

    const almavest6 = "0x418749e294cabce5a714efccc22a8aade6f9db57"
    const tranchedPool = await getTruffleContract<TranchedPoolInstance>("TranchedPool", {at: almavest6})
    const creditLine = await getTruffleContract<CreditLineInstance>("CreditLine", {at: await tranchedPool.creditLine()})

    const termEndTime = await creditLine.termEndTime()
    const gracePeriod = await config.getNumber(CONFIG_KEYS.LatenessGracePeriodInDays)

    const oneHundredDaysInSeconds = 100 * 24 * 60 * 60
    await advanceTime({seconds: termEndTime.add(gracePeriod).add(new BN(oneHundredDaysInSeconds))})

    const protocolOwner = await getProtocolOwner()
    await impersonateAccount(hre, protocolOwner)
    await fundWithWhales(["ETH"], [protocolOwner])
    await tranchedPool.assess()
  })

  it("is reproducable", async () => {
    const tokenId1 = 604
    const tokenId2 = 605

    const [exploiter, someUser] = await web3.eth.getAccounts()
    assertNonNullable(exploiter)
    assertNonNullable(someUser)
    await legacyConfig.addToGoList(exploiter)
    await legacyConfig.addToGoList(someUser)

    // Give the senior pool a bunch of free capital that the exploiter will steal
    await fundWithWhales(["ETH"], [someUser])
    await fundWithWhales(["USDC"], [someUser], 10_000_000)
    await usdc.approve(seniorPool.address, usdcVal(10_000_000), {from: someUser})
    await seniorPool.deposit(usdcVal(10_000_000), {from: someUser})

    await fundWithWhales(["ETH"], [exploiter])
    await fundWithWhales(["USDC"], [exploiter], 200_000_000)

    const sharePriceBefore = await seniorPool.sharePrice()
    const exploiterUsdcBalanceBefore = await usdc.balanceOf(exploiter)
    const seniorPoolUsdcBalanceBefore = await usdc.balanceOf(seniorPool.address)

    // With the current parameters (expected reduction in share price according to days late,
    // 200M starting capital for exploiter, 10M liquid), only 2 rounds are needed to take
    // the 10M liquid
    const requiredRounds = 2

    for (let i = 0; i < requiredRounds; i++) {
      await seniorPool.writedown(tokenId2)

      await usdc.approve(seniorPool.address, usdcVal(100_000_000), {from: exploiter})
      await seniorPool.deposit(usdcVal(100_000_000), {from: exploiter})

      await seniorPool.writedown(tokenId1)

      const seniorPoolBalance = await usdc.balanceOf(seniorPool.address)
      const fiduAmount = await fidu.balanceOf(exploiter)
      const seniorPoolBalanceInFidu = await seniorPool.getNumShares(seniorPoolBalance)
      const toWithdraw = BN.min(fiduAmount, seniorPoolBalanceInFidu)

      await fidu.approve(seniorPool.address, toWithdraw, {from: exploiter})
      await seniorPool.withdrawInFidu(toWithdraw, {from: exploiter})
    }

    const sharePriceAfter = await seniorPool.sharePrice()
    const exploiterUsdcBalanceAfter = await usdc.balanceOf(exploiter)
    const seniorPoolUsdcBalanceAfter = await usdc.balanceOf(seniorPool.address)

    // Output with exploit:
    // {
    //   sharePriceBefore: '1083827382059951089',
    //   sharePriceAfter: '954116230333084068',
    //   exploiterUsdcBalanceBefore: '200000000000000',
    //   seniorPoolUsdcBalanceBefore: '10000000000001',
    //   exploiterUsdcBalanceAfter: '208950000000001',
    //   seniorPoolUsdcBalanceAfter: '1'
    // }
    console.log({
      sharePriceBefore: sharePriceBefore.toString(),
      sharePriceAfter: sharePriceAfter.toString(),
      exploiterUsdcBalanceBefore: exploiterUsdcBalanceBefore.toString(),
      seniorPoolUsdcBalanceBefore: seniorPoolUsdcBalanceBefore.toString(),
      exploiterUsdcBalanceAfter: exploiterUsdcBalanceAfter.toString(),
      seniorPoolUsdcBalanceAfter: seniorPoolUsdcBalanceAfter.toString(),
    })

    // Balance after should be less than balance before, due withdrawal fees
    // If the exploit were possible, balance would be higher as the exploiter would
    // be able to take the 10M available liquidity (less withdrawal fees).
    expect(exploiterUsdcBalanceAfter).to.bignumber.lt(exploiterUsdcBalanceBefore)
  })
})
