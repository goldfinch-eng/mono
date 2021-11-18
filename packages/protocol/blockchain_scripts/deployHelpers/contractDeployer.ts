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
    // const sizeInKiloBytes = result.bytecode!.length / 2 / 1024
    // const {deployedBytecode} = await this.hre.artifacts.readArtifact(contractName);
    const deployedBytecode = result.deployedBytecode!
    // console.log(`${name}: ${deployedBytecode.length / 2 / 1024}`)
    const size = Buffer.from(deployedBytecode.replace(/__\$\w*\$__/g, "0".repeat(40)).slice(2), "hex").length
    const sizeInKiloBytes = size / 1024

    this.logger(`${contractName} was deployed to: ${result.address} (${sizeInKiloBytes}kb)`)
    // if (options.libraries && Object.keys((result as any).deployedLinkReferences).length === 0) {
    //   throw new Error("Library was not linked")
    // }
    if (sizeInKiloBytes > 20) {
      // throw new Error(`${contractName} too big: ${sizeInKiloBytes}kb`)
    }

    return (await ethers.getContractAt(result.abi, result.address)) as T
  }

  async deployLibrary(libraryName: string, options: DeployOptions): Promise<DeployResult> {
    const result = await this.hre.deployments.deploy(libraryName, options)
    const sizeInKiloBytes = result.deployedBytecode!.length / 2 / 1024
    this.logger(`${libraryName} library was deployed to: ${result.address} (${sizeInKiloBytes}kb)`)
    return result
  }
}
