import {HardhatRuntimeEnvironment} from "hardhat/types"
import {ethers} from "hardhat"
import {DeployOptions, DeployResult} from "hardhat-deploy/types"
import {Contract, BaseContract} from "ethers"

import {Logger} from "../types"
import {getProtocolOwner} from "./"
import {assertIsString} from "../../../utils"

export class ContractDeployer {
  public readonly logger: Logger
  public readonly hre: HardhatRuntimeEnvironment

  constructor(logger: Logger, hre: HardhatRuntimeEnvironment) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.logger = process.env.CI ? () => {} : logger
    this.hre = hre
  }

  async getNamedAccounts() {
    return this.hre.getNamedAccounts()
  }

  async getChainId() {
    return this.hre.getChainId()
  }

  async deploy<T extends BaseContract | Contract = Contract>(contractName: string, options: DeployOptions): Promise<T> {
    if (typeof options === "object" && typeof options?.proxy === "object" && options?.proxy && !options?.proxy?.owner) {
      const protocol_owner = await getProtocolOwner()
      options = {proxy: {owner: protocol_owner, ...options.proxy}, ...options}
    }
    const result = await this.hre.deployments.deploy(contractName, options)
    this.logger(`${contractName} was deployed to: ${result.address} (${this.sizeInKb(result).toFixed(3)}kb)`)

    return (await ethers.getContractAt(result.abi, result.address)) as T
  }

  async deployLibrary(libraryName: string, options: DeployOptions): Promise<DeployResult> {
    const result = await this.hre.deployments.deploy(libraryName, options)
    this.logger(`${libraryName} library was deployed to: ${result.address} (${this.sizeInKb(result).toFixed(3)}kb)`)
    return result
  }

  private sizeInKb(result: DeployResult) {
    const deployedBytecode = result.deployedBytecode
    assertIsString(deployedBytecode)
    // From https://github.com/ItsNickBarry/hardhat-contract-sizer/blob/master/index.js#L33
    const size = Buffer.from(deployedBytecode.replace(/__\$\w*\$__/g, "0".repeat(40)).slice(2), "hex").length
    return size / 1024
  }
}
