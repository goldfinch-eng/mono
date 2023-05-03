import {GoldfinchConfig} from "../../../../typechain/ethers"
import hre, {ethers, deployments} from "hardhat"
import {getEthersContract, getProtocolOwner} from "../../../../blockchain_scripts/deployHelpers"
import {
  getDeployEffects,
  DeployEffects,
  changeImplementations,
} from "../../../../blockchain_scripts/migrations/deployEffects"
import {TEST_TIMEOUT} from "../../MainnetForking.test"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"
import {impersonateAccount} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/impersonateAccount"

async function getImplementationAddress(address: string): Promise<string> {
  const implStorageLocation = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  let implementationAddress = await ethers.provider.getStorageAt(address, implStorageLocation)
  implementationAddress = ethers.utils.hexStripZeros(implementationAddress)
  if (implementationAddress !== "0x") {
    return implementationAddress
  }
  throw new Error("implementation address was 0x")
}

const setupTest = deployments.createFixture(async ({deployments}) => {
  await deployments.fixture("pendingMainnetMigrations", {keepExistingDeployments: true})
})

// Note that these tests relies on the fact that, for mainnet-forking, the transaction is mined as well as submitted.
describe("deployEffects", () => {
  let protocolOwner: string
  let deployEffects: DeployEffects

  beforeEach(async function () {
    this.timeout(TEST_TIMEOUT)
    await setupTest()

    protocolOwner = await getProtocolOwner()
    await impersonateAccount(hre, protocolOwner)
    await fundWithWhales(["ETH"], [protocolOwner])

    deployEffects = await getDeployEffects()
  })

  describe("effects", async () => {
    it("handles arbitrary deferred effects in bulk", async () => {
      const config = await getEthersContract<GoldfinchConfig>("GoldfinchConfig")

      await deployEffects.add({
        deferred: [
          await config.populateTransaction.setNumber(54321, "1"),
          await config.populateTransaction.setAddress(54322, "0x0000000000000000000000000000000000000001"),
        ],
      })
      await deployEffects.executeDeferred()

      expect((await config.getNumber(54321)).toString()).to.eq("1")
      expect(await config.getAddress(54322)).to.eq("0x0000000000000000000000000000000000000001")
    })

    it("handles changeImplementations", async () => {
      const deploys = {
        PoolTokens: await deployments.get("PoolTokens"),
        Fidu: await deployments.get("Fidu"),
      }
      await deployEffects.add(
        await changeImplementations({
          contracts: {
            PoolTokens: {
              ProxyContract: new ethers.Contract(deploys.PoolTokens.address, deploys.PoolTokens.abi),
              UpgradedImplAddress: "0x0000000000000000000000000000000000000001",
            },
            Fidu: {
              ProxyContract: new ethers.Contract(deploys.Fidu.address, deploys.Fidu.abi),
              UpgradedImplAddress: "0x0000000000000000000000000000000000000002",
            },
          },
        } as any)
      )

      await deployEffects.executeDeferred()

      expect(await getImplementationAddress(deploys.PoolTokens.address)).to.eq(
        ethers.utils.hexStripZeros("0x0000000000000000000000000000000000000001")
      )
      expect(await getImplementationAddress(deploys.Fidu.address)).to.eq(
        ethers.utils.hexStripZeros("0x0000000000000000000000000000000000000002")
      )
    })
  })
})
