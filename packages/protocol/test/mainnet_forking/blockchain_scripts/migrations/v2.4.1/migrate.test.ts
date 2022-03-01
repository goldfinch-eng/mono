import hre, {deployments, getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {getEthersContract, getProtocolOwner} from "packages/protocol/blockchain_scripts/deployHelpers"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

import * as migrate241 from "@goldfinch-eng/protocol/blockchain_scripts/migrations/v2.4.1/migrate"
import {mochaEach} from "@goldfinch-eng/protocol/test/testHelpers"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"
import {TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"

const expectedPools = [
  "0x1e73b5C1A3570B362d46Ae9Bf429b25c05e514A7",
  "0x95715d3dcbB412900DEaF91210879219eA84b4f8",
  "0x2107adE0E536b8b0b85cca5E0c0C3F66E58c053C",
  "0xd798d527F770ad920BB50680dBC202bB0a1DaFD6",
  "0x6B42b1A43abE9598052BB8c21FD34C46c9fBCb8b",
  "0x418749e294cAbce5A714EfcCC22a8AAde6F9dB57",
  "0xA49506632CE8ec826b0190262B89A800353675eC",
  "0x00c27FC71b159a346e179b4A1608a0865e8A7470",
  "0xd09a57127BC40D680Be7cb061C2a6629Fe71AbEf",
  "0x67df471eacd82c3dbc95604618ff2a1f6b14b8a1",
  "0x1e73b5c1a3570b362d46ae9bf429b25c05e514a7",
  "0xd798d527f770ad920bb50680dbc202bb0a1dafd6",
  "0x2107ade0e536b8b0b85cca5e0c0c3f66e58c053c",
]

const setupTest = deployments.createFixture(async () => {
  await deployments.fixture("base_deploy", {keepExistingDeployments: true})

  const {gf_deployer} = await getNamedAccounts()
  assertIsString(gf_deployer)
  await fundWithWhales(["ETH"], [gf_deployer])
  await impersonateAccount(hre, await getProtocolOwner())
  await fundWithWhales(["ETH"], [await getProtocolOwner()])
})

const performV241Deployment = deployments.createFixture(async () => {
  await migrate241.main()
})

describe("v2.4.1", async () => {
  it("our expected pool list should include all of our pools we manually confirmed need to be paused", () => {
    for (const address of migrate241.repaidPoolAddressesToPauseDrawdowns) {
      expect(expectedPools).to.contain(address)
    }
  })

  beforeEach(async () => {
    await setupTest()
  })

  describe("after deploy", async () => {
    beforeEach(async () => {
      await performV241Deployment()
    })

    mochaEach(expectedPools).it("pool at %s should have drawdowns paused", async (address) => {
      const tranchedPool = await getEthersContract<TranchedPool>("TranchedPool", {at: address})
      expect(await tranchedPool.drawdownsPaused()).to.be.true
    })
  })
})
