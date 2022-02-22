import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {getProtocolOwner, getTruffleContract} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate2_5 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.5/migrate"
import {expectOwnerRole, expectProxyOwner} from "@goldfinch-eng/protocol/test/testHelpers"
import {TEST_TIMEOUT} from "../../../MainnetForking.test"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {GoInstance} from "@goldfinch-eng/protocol/typechain/truffle"

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const go = await getTruffleContract<GoInstance>("Go")

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])

  await migrate2_5.main()

  return {
    go,
  }
})

describe("v2.5", async function () {
  this.timeout(TEST_TIMEOUT)

  beforeEach(async () => {
    await setupTest()
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
