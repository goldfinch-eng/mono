import hre, {ethers} from "hardhat"
import Safe, {EthersAdapter} from "@gnosis.pm/safe-core-sdk"
import {
  encodeMultiSendData,
  standardizeMetaTransactionData,
} from "@gnosis.pm/safe-core-sdk/dist/src/utils/transactions/utils"
import {SafeTransactionDataPartial} from "@gnosis.pm/safe-core-sdk-types"

import {
  assertIsChainId,
  ChainId,
  currentChainId,
  getProtocolOwner,
  isMainnetForking,
  LOCAL_CHAIN_ID,
} from "../deployHelpers"
import {fundWithWhales, UpgradedContracts} from "../mainnetForkingHelpers"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {DefenderUpgrader} from "../adminActions/defenderUpgrader"
import {PopulatedTransaction} from "@ethersproject/contracts"
import {BigNumber} from "ethers"

/**
 * Interface for performing bulk actions during protocol upgrades. The underlying
 * implementation might be a gnosis multisend or a custom migrator contract.
 *
 * Callers should assume that promise resolution means the tx has been submitted
 * but *not* necessarily mined, since the underlying implementation might be a multisig
 * that requires additional approvals for execution.
 */
export interface DeployEffects {
  add(effects?: Effects): Promise<void>
  executeDeferred(): Promise<void>
}

/**
 * Describes effects that must be executed as part of deploys by the owner multisig.
 * This can include things like setting config values or granting roles.
 *
 *  - `immediate` effects are executed immediately when added using `DeployEffects.add`.
 *  - `deferred` effects are collected and executed, possibly in bulk, when `DeployEffects.executeDeferred` is called.
 */
export type Effects = {
  /**
   * "immediate" effects are executed immediately when added using `DeployEffects.add`
   */
  immediate?: PopulatedTransaction[]
  /**
   * "deferred" effects are collected and executed, possibly in bulk, when `DeployEffects.executeDeferred` is called
   */
  deferred?: PopulatedTransaction[]
}

export async function changeImplementations({contracts}: {contracts: UpgradedContracts}): Promise<Effects> {
  const partialTxs = await Promise.all(
    Object.keys(contracts).map(async (contractName) => {
      const contractHolder = contracts[contractName]
      assertNonNullable(contractHolder, "contractHolder is undefined")
      const proxy = contractHolder.ProxyContract.connect(await getProtocolOwner())
      // hardhat-deploy changed the method name in newer versions
      const upgradeMethod =
        proxy.populateTransaction["changeImplementation"] || proxy.populateTransaction["upgradeToAndCall"]
      assertNonNullable(upgradeMethod, `upgradeMethod is undefined for ${contractName}`)
      const unsignedTx = await upgradeMethod(contractHolder.UpgradedImplAddress, "0x")
      return unsignedTx
    })
  )

  return {
    deferred: partialTxs,
  }
}

export abstract class MultisendEffects implements DeployEffects {
  deferredEffects: PopulatedTransaction[] = []

  abstract execute(safeTxs: SafeTransactionDataPartial[]): Promise<void>

  private toSafeTx(tx: PopulatedTransaction): SafeTransactionDataPartial {
    return {
      to: asNonNullable(tx.to),
      data: asNonNullable(tx.data),
      value: tx.value?.toString() || "0",
    }
  }

  async runTxs(txs: PopulatedTransaction[]): Promise<void> {
    console.log("DeployEffects transactions")
    console.log(txs)
    await this.execute(txs.map(this.toSafeTx))
  }

  async add(effects?: Effects): Promise<void> {
    if (!effects) {
      return
    }

    if (effects.immediate) {
      throw new Error("'immediate' effects not implemented yet")
    }

    if (effects.deferred) {
      this.deferredEffects = this.deferredEffects.concat(effects.deferred)
    }
  }

  async executeDeferred(): Promise<void> {
    await this.runTxs(this.deferredEffects)
  }
}

/**
 * Execute the deploy effects by using the gnosis safe contract available from forking mainnet.
 */
class MainnetForkingMultisendEffects extends MultisendEffects {
  protected readonly safe: Safe

  constructor({safe}: {safe: Safe}) {
    super()
    this.safe = safe
  }

  async execute(safeTxs: SafeTransactionDataPartial[]): Promise<void> {
    const safeTx = await this.safe.createTransaction(...safeTxs)
    const safeTxHash = await this.safe.getTransactionHash(safeTx)
    const executor = await this.safe.getEthAdapter().getSignerAddress()
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [executor],
    })
    const threshold = await this.safe.getThreshold()
    const approvers = (await this.safe.getOwners()).filter((o) => o !== executor).splice(0, threshold - 1)
    await fundWithWhales(["ETH"], approvers)
    const signers = await Promise.all(approvers.map((a) => ethers.getSigner(a)))
    await Promise.all(
      signers.map(async (signer) => {
        hre.deployments.log(`Approving safe transaction as ${signer.address}...`)
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [signer.address],
        })
        const adapter = new EthersAdapter({ethers, signer})
        const _safe = await this.safe.connect({ethAdapter: adapter, safeAddress: this.safe.getAddress()})
        await _safe.approveTransactionHash(safeTxHash)
      })
    )
    hre.deployments.log(`Executing safe transaction as ${executor}...`)
    hre.deployments.log(safeTx)
    await this.safe.executeTransaction(safeTx, {gasLimit: 30000000})
  }
}

const MAINNET_AND_RINKEBY_MULTISEND_ADDRESS = "0x8d29be29923b68abfdd21e541b9374737b49cdad"
const MULTISEND_ABI =
  '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":false,"inputs":[{"internalType":"bytes","name":"transactions","type":"bytes"}],"name":"multiSend","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]'
const MULTISEND = {
  address: MAINNET_AND_RINKEBY_MULTISEND_ADDRESS,
  abi: JSON.parse(MULTISEND_ABI),
}

/**
 * Execute the deploy effects by submitting a proposal on defender to execute a multisend.
 */
class DefenderMultisendEffects extends MultisendEffects {
  private readonly chainId: ChainId

  constructor({chainId}: {chainId: ChainId}) {
    super()
    this.chainId = chainId
  }

  async execute(safeTxs: SafeTransactionDataPartial[]): Promise<void> {
    const multisendData = encodeMultiSendData(safeTxs.map(standardizeMetaTransactionData))
    const defender = new DefenderUpgrader({hre, logger: console.log, chainId: this.chainId})
    await defender.send({
      method: "multiSend",
      contract: MULTISEND,
      args: [multisendData],
      contractName: "Multisend",
      title: "Migrator multisend",
      description: "Executing migrator multisend",
      via: await getProtocolOwner(),
      viaType: "Gnosis Safe",
      metadata: {operationType: "delegateCall"},
    })
  }
}

/**
 * Execute the deploy effects by submitting each one as individual transactions.
 */
class IndividualTxEffects extends MultisendEffects {
  async execute(safeTxs: SafeTransactionDataPartial[]): Promise<void> {
    const signer = ethers.provider.getSigner(await getProtocolOwner())

    for (const tx of safeTxs) {
      await signer.sendTransaction({...tx, value: BigNumber.from(tx.value)})
    }
  }
}

const GNOSIS_EXECUTOR = "0xf13eFa505444D09E176d83A4dfd50d10E399cFd5"

async function getSafe(): Promise<Safe> {
  await fundWithWhales(["ETH"], [GNOSIS_EXECUTOR])
  const signer = await ethers.getSigner(GNOSIS_EXECUTOR)
  const ethAdapter = new EthersAdapter({ethers, signer})
  const safe = await Safe.create({
    ethAdapter,
    safeAddress: await getProtocolOwner(),
    contractNetworks: {
      31337: {
        multiSendAddress: "0x8D29bE29923b68abfDD21e541b9374737B49cdAD",
        safeMasterCopyAddress: "0x6851D6fDFAfD08c0295C392436245E5bc78B0185",
        safeProxyFactoryAddress: "0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B",
      },
    },
  })
  return safe
}

export async function getDeployEffects(): Promise<DeployEffects> {
  if (isMainnetForking()) {
    const safe = await getSafe()
    return new MainnetForkingMultisendEffects({safe})
  } else if ((await currentChainId()) === LOCAL_CHAIN_ID) {
    return new IndividualTxEffects()
  } else {
    const chainId = await hre.getChainId()
    assertIsChainId(chainId)
    return new DefenderMultisendEffects({chainId})
  }
}
