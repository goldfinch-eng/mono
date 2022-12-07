import hre, {ethers} from "hardhat"
import Safe, {EthersAdapter} from "@gnosis.pm/safe-core-sdk"
import {
  encodeMultiSendData,
  standardizeMetaTransactionData,
} from "@gnosis.pm/safe-core-sdk/dist/src/utils/transactions/utils"
import {generatePreValidatedSignature} from "@gnosis.pm/safe-core-sdk/dist/src/utils/signatures"
import {SafeTransactionDataPartial} from "@gnosis.pm/safe-core-sdk-types"

import {
  assertIsChainId,
  ChainId,
  currentChainId,
  getProtocolOwner,
  isMainnetForking,
  LOCAL_CHAIN_ID,
  MAINNET_CHAIN_ID,
  SAFE_CONFIG,
} from "../deployHelpers"
import {UpgradedContracts} from "../deployHelpers/upgradeContracts"
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {DefenderUpgrader} from "../adminActions/defenderUpgrader"
import {PopulatedTransaction} from "@ethersproject/contracts"
import {BigNumber} from "ethers"
import {fundWithWhales} from "../helpers/fundWithWhales"

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
  executeDeferred(params?: {dryRun?: boolean}): Promise<void>
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

export async function changeImplementations(
  {contracts}: {contracts: UpgradedContracts},
  proxyOwner?: string
): Promise<Effects> {
  const proxyContractConnector = proxyOwner || (await getProtocolOwner())
  const partialTxs = await Promise.all(
    Object.keys(contracts).map(async (contractName) => {
      const contractHolder = contracts[contractName]
      assertNonNullable(contractHolder, "contractHolder is undefined")
      const proxy = contractHolder.ProxyContract.connect(proxyContractConnector)
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

  abstract execute(safeTxs: SafeTransactionDataPartial[], params?: {dryRun?: boolean}): Promise<void>

  private toSafeTx(tx: PopulatedTransaction): SafeTransactionDataPartial {
    return {
      to: asNonNullable(tx.to),
      data: asNonNullable(tx.data),
      value: tx.value?.toString() || "0",
    }
  }

  async runTxs(txs: PopulatedTransaction[], params?: {dryRun?: boolean}): Promise<void> {
    await this.execute(txs.map(this.toSafeTx), params)
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

  async executeDeferred(params?: {dryRun?: boolean}): Promise<void> {
    await this.runTxs(this.deferredEffects, params)
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

const MAINNET_MULTISEND_ADDRESS = "0x8d29be29923b68abfdd21e541b9374737b49cdad"
const MULTISEND_ABI =
  '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":false,"inputs":[{"internalType":"bytes","name":"transactions","type":"bytes"}],"name":"multiSend","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]'
const MULTISEND = {
  address: MAINNET_MULTISEND_ADDRESS,
  abi: JSON.parse(MULTISEND_ABI),
}

const gnosisSafeAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
      {
        internalType: "enum Enum.Operation",
        name: "operation",
        type: "uint8",
      },
      {
        internalType: "uint256",
        name: "safeTxGas",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "baseGas",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "gasPrice",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "gasToken",
        type: "address",
      },
      {
        internalType: "address payable",
        name: "refundReceiver",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "signatures",
        type: "bytes",
      },
    ],
    name: "execTransaction",
    outputs: [
      {
        internalType: "bool",
        name: "success",
        type: "bool",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "hashToApprove",
        type: "bytes32",
      },
    ],
    name: "approveHash",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
]

/**
 * Execute the deploy effects by submitting a proposal on defender to execute a multisend.
 */
class DefenderMultisendEffects extends MultisendEffects {
  private readonly chainId: ChainId
  private readonly via?: string
  private readonly safeConfig?: {safeAddress: string; executor: string}
  private readonly title: string
  private readonly description: string

  constructor({
    chainId,
    via,
    title,
    description,
    safeConfig,
  }: {
    chainId: ChainId
    via?: string
    title?: string
    description?: string
    safeConfig?: {safeAddress: string; executor: string}
  }) {
    super()
    this.chainId = chainId
    this.via = via
    this.safeConfig = safeConfig
    this.title = title ?? "Migrator multisend"
    this.description = description ?? "Executing migrator multisend"
  }

  async execute(safeTxs: SafeTransactionDataPartial[], params?: {dryRun?: boolean}): Promise<void> {
    await this.logSafeTx(safeTxs)

    if (params?.dryRun) return

    const multisendData = encodeMultiSendData(safeTxs.map(standardizeMetaTransactionData))
    const defender = new DefenderUpgrader({hre, logger: console.log, chainId: this.chainId})
    const via = this.via == undefined ? await getProtocolOwner() : this.via
    await defender.send({
      method: "multiSend",
      contract: MULTISEND,
      args: [multisendData],
      contractName: "Multisend",
      title: this.title,
      description: this.description,
      via,
      viaType: "Gnosis Safe",
      metadata: {operationType: "delegateCall"},
    })
  }

  /**
   * Log the encoded Safe transaction so it can be easily simulated in tenderly.
   */
  private async logSafeTx(safeTxs: SafeTransactionDataPartial[]): Promise<void> {
    const safe = await getSafe({via: this.via, safeConfig: this.safeConfig})
    const safeTx = await safe.createTransaction(...safeTxs)
    const safeTxHash = await safe.getTransactionHash(safeTx)
    const safeContract = new ethers.Contract(safe.getAddress(), gnosisSafeAbi)

    const executor = await safe.getEthAdapter().getSignerAddress()
    const threshold = await safe.getThreshold()
    const approvers = (await safe.getOwners()).filter((o) => o !== executor).splice(0, threshold - 1)

    console.log("=== Run the following transactions in a tenderly fork to simulate the gnosis safe tx ===")
    for (const approver of approvers) {
      const unsignedApproveTx = await asNonNullable(safeContract.populateTransaction.approveHash)(safeTxHash)
      unsignedApproveTx.from = approver
      console.log("Approve tx:", JSON.stringify(unsignedApproveTx, null, 4))

      const signature = generatePreValidatedSignature(approver)
      safeTx.addSignature(signature)
    }

    const signature = generatePreValidatedSignature(executor)
    safeTx.addSignature(signature)
    const unsignedTx = await asNonNullable(safeContract.populateTransaction.execTransaction)(
      safeTx.data.to,
      safeTx.data.value,
      safeTx.data.data,
      safeTx.data.operation,
      safeTx.data.safeTxGas,
      safeTx.data.baseGas,
      safeTx.data.gasPrice,
      safeTx.data.gasToken,
      safeTx.data.refundReceiver,
      safeTx.encodedSignatures()
    )
    unsignedTx.from = executor
    console.log("Execute tx:", JSON.stringify(unsignedTx, null, 4))
    console.log("========================================================================================")
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

async function getSafe(overrides?: {
  via?: string
  safeConfig?: {safeAddress: string; executor: string}
}): Promise<Safe> {
  const via = overrides?.via === undefined ? await getProtocolOwner() : overrides.via

  let chainId = await hre.getChainId()
  assertIsChainId(chainId)
  if (isMainnetForking()) {
    chainId = MAINNET_CHAIN_ID
  }

  const safeConfig = overrides?.safeConfig === undefined ? SAFE_CONFIG[chainId] : overrides.safeConfig
  assertNonNullable(safeConfig, `Unknown Gnosis Safe for chain id ${chainId}`)
  const {executor} = safeConfig

  if (isMainnetForking()) {
    await fundWithWhales(["ETH"], [executor])
  }

  return constructSafe({via, executor})
}

async function constructSafe(params: {via?: string; executor: string}): Promise<Safe> {
  const via = params?.via === undefined ? await getProtocolOwner() : params.via

  const signer = await ethers.getSigner(params.executor)
  const ethAdapter = new EthersAdapter({ethers, signer})
  const safe = await Safe.create({
    ethAdapter,
    safeAddress: via,
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

export async function getDeployEffects(params?: {
  via?: string
  title?: string
  description?: string
  safeConfig?: {safeAddress: string; executor: string}
}): Promise<DeployEffects> {
  const via = params?.via
  const safeConfig = params?.safeConfig
  if (isMainnetForking()) {
    const safe = await getSafe({via, safeConfig})
    return new MainnetForkingMultisendEffects({safe})
  } else if ((await currentChainId()) === LOCAL_CHAIN_ID) {
    return new IndividualTxEffects()
  } else {
    const chainId = await hre.getChainId()
    assertIsChainId(chainId)
    return new DefenderMultisendEffects({
      chainId,
      via,
      title: params?.title,
      description: params?.description,
      safeConfig,
    })
  }
}
