import {HardhatRuntimeEnvironment} from "hardhat/types"
import {ContractDeployer, currentChainId} from "./"
import {getExistingContracts, upgradeContracts, UpgradedContracts} from "../mainnetForkingHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {Logger} from "../types"
import {openzeppelin_saveDeploymentManifest} from "./openzeppelin-upgrade-validation"

export class ContractUpgrader {
  private readonly logger: Logger
  private readonly hre: HardhatRuntimeEnvironment

  constructor(deployer: ContractDeployer) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.logger = deployer.logger
    this.hre = deployer.hre
  }

  async writeManifest({contracts}: {contracts: string[]}): Promise<UpgradedContracts> {
    const {network} = this.hre
    const {gf_deployer} = await this.hre.getNamedAccounts()
    assertNonNullable(gf_deployer)
    const chainId = await currentChainId()
    this.logger(`Upgrading contracts: ${contracts}`)
    const existingContracts = await getExistingContracts(contracts, gf_deployer, chainId)
    contracts.forEach(async (contract) => {
      console.log("existingContracts", existingContracts[contract])
      await openzeppelin_saveDeploymentManifest(
        provider,
        existingContracts[contract]?.ProxyContract,
        existingContracts[contract]?.ExistingContract
      )
    })
  }
}
