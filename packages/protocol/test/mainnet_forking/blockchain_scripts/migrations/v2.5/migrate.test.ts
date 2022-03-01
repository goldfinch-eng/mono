import hre, {deployments, ethers, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {
  getProtocolOwner,
  getTruffleContract,
  getUSDCAddress,
  MAINNET_CHAIN_ID,
} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate25 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5/migrate"
import {createPoolWithCreditLine, expectOwnerRole, expectProxyOwner} from "@goldfinch-eng/protocol/test/testHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {
  GoInstance,
  GoldfinchFactoryInstance,
  TranchedPoolInstance,
  UniqueIdentityInstance,
} from "@goldfinch-eng/protocol/typechain/truffle"
import {getExistingContracts, MAINNET_MULTISIG} from "@goldfinch-eng/protocol/blockchain_scripts/mainnetForkingHelpers"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import BN from "bn.js"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const mainnetMultisigSigner = ethers.provider.getSigner(MAINNET_MULTISIG)
  const contractNames = ["SeniorPool", "Fidu", "GoldfinchFactory", "GoldfinchConfig", "Go"]
  const existingContracts = await getExistingContracts(contractNames, mainnetMultisigSigner)
  assertNonNullable(existingContracts.SeniorPool)
  assertNonNullable(existingContracts.Fidu)
  assertNonNullable(existingContracts.GoldfinchConfig)
  assertNonNullable(existingContracts.GoldfinchFactory)

  const go = await getTruffleContract<GoInstance>("Go")
  const uniqueIdentity = await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity")

  const goldfinchFactory: GoldfinchFactoryInstance = await artifacts
    .require("GoldfinchFactory")
    .at(existingContracts.GoldfinchFactory.ExistingContract.address)

  const usdcAddress = getUSDCAddress(MAINNET_CHAIN_ID)
  assertIsString(usdcAddress)
  const usdc = await artifacts.require("IERC20withDec").at(usdcAddress)

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {
    usdc,
    go,
    uniqueIdentity,
    goldfinchFactory,
  }
})

describe("v2.5", async function () {
  let uniqueIdentity, tranchedPool: TranchedPoolInstance, goldfinchFactory, usdc
  let borrower
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    const setupTestResult = await setupTest()
    uniqueIdentity = setupTestResult.uniqueIdentity
    usdc = setupTestResult.usdc
    goldfinchFactory = setupTestResult.goldfinchFactory
  })

  it("v2.5 properly upgrades UniqueIdentity", async () => {
    expect(await uniqueIdentity.supportedUIDTypes(0)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(1)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(2)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(3)).to.equal(false)
    expect(await uniqueIdentity.supportedUIDTypes(4)).to.equal(false)
    await migrate25.main()
    expect(await uniqueIdentity.supportedUIDTypes(0)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(1)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(2)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(3)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(4)).to.equal(true)
  })

  context("after deploy", async () => {
    beforeEach(async () => {
      await migrate25.main()
    })

    it("properly returns supportedUIDTypes", async () => {
      const [, , , , , maybeBorrower] = await hre.getUnnamedAccounts()
      borrower = asNonNullable(maybeBorrower)
      ;({tranchedPool} = await createPoolWithCreditLine({
        people: {borrower, owner: MAINNET_MULTISIG},
        usdc,
        goldfinchFactory,
        allowedUIDTypes: [0, 1, 2, 3, 4],
      }))

      expect(await (await tranchedPool.getAllowedUIDTypes()).map((x) => x.toNumber())).to.deep.equal([0, 1, 2, 3, 4])
    })

    expectProxyOwner({
      toBe: getProtocolOwner,
      forContracts: ["Go"],
    })

    expectOwnerRole({
      toBe: async () => getProtocolOwner(),
      forContracts: ["Go"],
    })
  })
})
