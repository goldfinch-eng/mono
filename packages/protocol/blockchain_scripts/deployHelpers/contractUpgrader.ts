import {HardhatRuntimeEnvironment} from "hardhat/types"
import {ContractDeployer, currentChainId} from "./"
import {getExistingContracts, upgradeContracts, UpgradedContracts} from "../mainnetForkingHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {Logger} from "../types"
import {openzeppelin_assertIsValidImplementation} from "./openzeppelin-upgrade-validation"

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

  async upgrade({contracts}: {contracts: string[]}): Promise<UpgradedContracts> {
    const {gf_deployer} = await this.hre.getNamedAccounts()
    assertNonNullable(gf_deployer)
    const chainId = await currentChainId()
    this.logger(`Upgrading contracts: ${contracts}`)
    const existingContracts = await getExistingContracts(contracts, gf_deployer, chainId)
    contracts.forEach(async (c) => {
      const implDepoyment = await this.hre.deployments.get(`${c}_Implementation`)
      await openzeppelin_assertIsValidImplementation(implDepoyment)
    })
    const upgradedContracts = await upgradeContracts({
      contractsToUpgrade: contracts,
      contracts: existingContracts,
      signer: gf_deployer,
      deployFrom: gf_deployer,
      deployer: this.deployer,
      logger: this.logger,
    })
    return upgradedContracts
  }
}
