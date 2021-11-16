import {HardhatRuntimeEnvironment} from "hardhat/types"
import {ethers} from "hardhat"
import {DeployOptions, DeployResult} from "hardhat-deploy/types"
import {Contract, BaseContract} from "ethers"

import {Logger} from "../types"
import {getProtocolOwner} from "./"

export class ContractDeployer {
  public readonly logger: Logger
  public readonly hre: HardhatRuntimeEnvironment

  constructor(logger: Logger, hre: HardhatRuntimeEnvironment) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.logger = process.env.NODE_ENV === "test" ? () => {} : logger
    this.hre = hre
  }

  async getNamedAccounts() {
    return this.hre.getNamedAccounts()
  }

  async getChainId() {
    return this.hre.getChainId()
  }

  async deploy<T extends BaseContract | Contract = Contract>(contractName: string, options: DeployOptions): Promise<T> {
    if (options?.proxy && !options?.proxy?.owner) {
      const protocol_owner = await getProtocolOwner()
      Object.assign(options.proxy, {owner: protocol_owner, ...options.proxy})
    }
    const result = await this.hre.deployments.deploy(contractName, options)
    this.logger(`${contractName} was deployed to: ${result.address}`)
    return (await ethers.getContractAt(result.abi, result.address)) as T
  }

  async deployLibrary(libraryName: string, options: DeployOptions): Promise<DeployResult> {
    const result = await this.hre.deployments.deploy(libraryName, options)
    this.logger(`${libraryName} library was deployed to: ${result.address}`)
    return result
  }
}
