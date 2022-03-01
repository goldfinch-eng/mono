import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {getProtocolOwner, getTruffleContract} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate2_5 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5/migrate"
import {expectOwnerRole, expectProxyOwner} from "@goldfinch-eng/protocol/test/testHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {GoInstance, UniqueIdentityInstance} from "@goldfinch-eng/protocol/typechain/truffle"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const go = await getTruffleContract<GoInstance>("Go")
  const uniqueIdentity = await getTruffleContract<UniqueIdentityInstance>("UniqueIdentity")

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  return {
    go,
    uniqueIdentity,
  }
})

describe("v2.5", async function () {
  let uniqueIdentity
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    const setupTestResult = await setupTest()
    uniqueIdentity = setupTestResult.uniqueIdentity
  })

  it("v2.5 properly upgrades UniqueIdentity", async () => {
    expect(await uniqueIdentity.supportedUIDTypes(0)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(1)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(2)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(3)).to.equal(false)
    expect(await uniqueIdentity.supportedUIDTypes(4)).to.equal(false)
    await migrate2_5.main()
    expect(await uniqueIdentity.supportedUIDTypes(0)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(1)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(2)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(3)).to.equal(true)
    expect(await uniqueIdentity.supportedUIDTypes(4)).to.equal(true)
  })

  context("after deploy", async () => {
    beforeEach(async () => {
      await migrate2_5.main()
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
