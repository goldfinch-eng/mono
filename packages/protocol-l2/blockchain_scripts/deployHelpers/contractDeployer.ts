import {HardhatRuntimeEnvironment} from "hardhat/types"
import {ethers} from "hardhat"
import {DeployOptions, DeployResult} from "hardhat-deploy/types"
import {Contract, BaseContract} from "ethers"

import {Logger} from "../types"
import {fixProvider, getProtocolOwner, isTestEnv} from "./"
import {assertIsString, isPlainObject} from "../../../utils"
import {openzeppelin_saveDeploymentManifest} from "./openzeppelin-upgrade-validation"
import {assertNonNullable} from "@goldfinch-eng/utils"

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
    options = await this.withDefaults(options)

    const proxyPreviouslyExists = await this.hre.deployments.getOrNull(`${contractName}`)
    const deployResult = await this.deployHandlingUnknownSigner(contractName, options)

    // if a new proxy deployment, generate the manifest for hardhat-upgrades
    if (isPlainObject(options) && isPlainObject(options?.proxy) && !proxyPreviouslyExists && !isTestEnv()) {
      await this.writeDeploymentManifest(contractName)
    }

    return (await ethers.getContractAt(deployResult.abi, deployResult.address)) as T
  }

  private async deployHandlingUnknownSigner(contractName: string, options: DeployOptions): Promise<DeployResult> {
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
      await this.hre.deployments.get(`${contractName}_Implementation`)
      // Be consistent with hardhat-deploy's behavior of returning the proxy deployment
      // (rather than impl deployment) for proxy deploys
      result = {newlyDeployed: false, ...(await this.hre.deployments.get(contractName))}
      this.logger(
        `${contractName} implementation was deployed to: ${result.address} (${this.sizeInKb(result).toFixed(3)}kb)`
      )
    }

    return result
  }

  private async writeDeploymentManifest(contractName: string) {
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

  private async withDefaults(options: DeployOptions): Promise<DeployOptions> {
    options = await this.withProxyDefaults(options)
    options = await this.withFeeDataDefaults(options)
    return options
  }

  private async withProxyDefaults(options: DeployOptions): Promise<DeployOptions> {
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

    return options
  }

  private async withFeeDataDefaults(options: DeployOptions): Promise<DeployOptions> {
    const newOptions = {...options}

    // If gasPrice is specified, then the intent was to run a pre-EIP-1559 tx
    if (!options.gasPrice) {
      const feeData = await ethers.provider.getFeeData()
      if (!feeData.maxPriorityFeePerGas) {
        console.warn("maxPriorityFeePerGas from ethers was undefined. Defaulting to 1 gwei...")
        feeData.maxPriorityFeePerGas = ethers.utils.parseUnits("1", "gwei")
      }
      assertNonNullable(feeData.maxFeePerGas, "Error fetching fee data (maxFeePerGas)")
      assertNonNullable(feeData.maxPriorityFeePerGas, "Error fetching fee data (maxPriorityFeePerGas)")
      if (!newOptions.maxFeePerGas) {
        newOptions.maxFeePerGas = feeData.maxFeePerGas
      }
      if (!newOptions.maxPriorityFeePerGas) {
        newOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
      }
    }

    return newOptions
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
