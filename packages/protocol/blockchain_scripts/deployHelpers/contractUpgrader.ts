import {HardhatRuntimeEnvironment} from "hardhat/types"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {ContractDeployer, currentChainId} from "./"
import {getExistingContracts} from "./getExistingContracts"
import {UpgradedContracts, upgradeContracts, ContractUpgradeData, getName} from "./upgradeContracts"
import {Logger} from "../types"

export class ContractUpgrader {
  private readonly logger: Logger
  private readonly hre: HardhatRuntimeEnvironment
  private readonly deployer: ContractDeployer

  constructor(deployer: ContractDeployer) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.logger = deployer.logger
    this.hre = deployer.hre
    this.deployer = deployer
  }

  async upgrade(
    {contracts}: {contracts: ContractUpgradeData[]},
    options: {proxyOwner?: string} = {}
  ): Promise<UpgradedContracts> {
    const {gf_deployer} = await this.hre.getNamedAccounts()
    assertNonNullable(gf_deployer)
    const chainId = await currentChainId()
    this.logger(`Upgrading contracts: ${contracts.map(getName)}`)
    const existingContracts = await getExistingContracts(contracts.map(getName), gf_deployer, chainId)
    const upgradedContracts = await upgradeContracts({
      contractsToUpgrade: contracts,
      contracts: existingContracts,
      signer: gf_deployer,
      deployFrom: gf_deployer,
      deployer: this.deployer,
      proxyOwner: options.proxyOwner,
      logger: this.logger,
    })
    return upgradedContracts
  }
}
