import {HardhatRuntimeEnvironment} from "hardhat/types"
import {ethers} from "hardhat"
import {DeployOptions, DeployResult} from "hardhat-deploy/types"
import {Contract, BaseContract} from "ethers"

import {Logger} from "../types"
import {fixProvider, getProtocolOwner} from "./"
import {assertIsString, isPlainObject} from "../../../utils"
import {openzeppelin_saveDeploymentManifest} from "./openzeppelin-upgrade-validation"

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
    if (isPlainObject(options) && isPlainObject(options?.proxy) && !options?.proxy?.owner) {
      const protocol_owner = await getProtocolOwner()
      options = {
        ...options,
        proxy: {
          ...options.proxy,
          owner: protocol_owner,
        },
      }
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
      this.logger(`${contractName} was deployed to: ${result.address} (${this.sizeInKb(result).toFixed(3)}kb)`)
    } else {
      // This happens when deploying a new proxy implementation. We want hardhat-deploy to correctly write out
      // the implementation deployment file. But its default behavior is to attempt to change the implementation
      // which we can't do because our owner is a multisig.
      const impl = await this.hre.deployments.get(`${contractName}_Implementation`)
      // Be consistent with hardhat-deploy's behavior of returning the proxy deployment
      // (rather than impl deployment) for proxy deploys
      result = {newlyDeployed: false, ...(await this.hre.deployments.get(contractName))}
      this.logger(
        `${contractName} implementation was deployed to: ${result.address} (${this.sizeInKb(result).toFixed(3)}kb)`
      )
    }

    // if a proxy, generate the manifest for hardhat-upgrades
    if (isPlainObject(options) && isPlainObject(options?.proxy)) {
      const {network} = this.hre
      const proxyContractDeployment = await this.hre.deployments.get(`${contractName}`)
      const implContractDeployment = await this.hre.deployments.get(`${contractName}_Implementation`)
      try {
        await openzeppelin_saveDeploymentManifest(
          fixProvider(network.provider),
          proxyContractDeployment,
          implContractDeployment
        )
      } catch (e) {
        this.logger(`Error saving manifest for ${contract}: ${e}`)
      }
    }

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
