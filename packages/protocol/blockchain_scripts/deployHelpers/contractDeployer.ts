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
    if (typeof options === "object" && typeof options?.proxy === "object" && options?.proxy && !options?.proxy?.owner) {
      const protocol_owner = await getProtocolOwner()
      options = {proxy: {owner: protocol_owner, ...options.proxy}, ...options}
    }
    let result: DeployResult
    const unsignedTx = await this.hre.deployments.catchUnknownSigner(
      async () => {
        await this.hre.deployments.deploy(contractName, options)
      },
      {log: false}
    )

    if (!unsignedTx) {
      result = {newlyDeployed: true, ...(await this.hre.deployments.get(contractName))}
      this.logger(`${contractName} was deployed to: ${result.address}`)
    } else {
      // This happens when deploying a new proxy implementation. We want hardhat-deploy to correctly write out
      // the implementation deployment file. But its default behavior is to attempt to change the implementation
      // which we can't do because our owner is a multisig.
      const impl = await this.hre.deployments.get(`${contractName}_Implementation`)
      this.logger(`${contractName} implementation was deployed to: ${impl.address}`)
      // Be consistent with hardhat-deploy's behavior of returning the proxy deployment
      // (rather than impl deployment) for proxy deploys
      result = {newlyDeployed: false, ...(await this.hre.deployments.get(contractName))}
    }

    return (await ethers.getContractAt(result.abi, result.address)) as T
  }

  async deployLibrary(libraryName: string, options: DeployOptions): Promise<DeployResult> {
    const result = await this.hre.deployments.deploy(libraryName, options)
    this.logger(`${libraryName} library was deployed to: ${result.address}`)
    return result
  }
}
