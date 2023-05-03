import {getNamedAccounts} from "hardhat"
import {assertIsString} from "packages/utils/src/type"
import {deploy} from "packages/protocol/blockchain_scripts/migrations/v2.0.1/deploy"
import {ETHDecimals, MINTER_ROLE, OWNER_ROLE, PAUSER_ROLE} from "packages/protocol/blockchain_scripts/deployHelpers"
import BN from "bn.js"
import {getDeployEffects} from "packages/protocol/blockchain_scripts/migrations/deployEffects"
import {fundWithWhales} from "@goldfinch-eng/protocol/blockchain_scripts/helpers/fundWithWhales"

xdescribe("v2.0.1", () => {
  beforeEach(async () => {
    const {gf_deployer} = await getNamedAccounts()
    assertIsString(gf_deployer)
    await fundWithWhales(["ETH"], [gf_deployer])
  })

  describe("deployment", async () => {
    it("deploys with the right params", async () => {
      const deployEffects = await getDeployEffects()
      const tempMultisig = "0x60D2bE34bCe277F5f5889ADFD4991bAEFA17461c"
      const {deployedContracts} = await deploy(deployEffects)
      const gfi = deployedContracts.gfi
      expect(gfi.address).to.be.a.string
      expect(await gfi.hasRole(OWNER_ROLE, tempMultisig)).to.be.true
      expect(await gfi.hasRole(MINTER_ROLE, tempMultisig)).to.be.true
      expect(await gfi.hasRole(PAUSER_ROLE, tempMultisig)).to.be.true
      expect(String(await gfi.cap())).to.bignumber.eq(String(new BN(100000000).mul(ETHDecimals)))
      expect(String(await gfi.name())).to.eq("Goldfinch")
      expect(String(await gfi.symbol())).to.eq("GFI")
    })
  })
})
