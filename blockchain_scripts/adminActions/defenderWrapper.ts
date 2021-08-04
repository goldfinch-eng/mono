import {DefenderUpgrader} from "./defenderUpgrader.js"
import hre from "hardhat"
const {artifacts}  = hre
import {LOCAL_CHAIN_ID, MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID} from "../deployHelpers"
import MethodMissing from 'method-missing'
import { HardhatRuntimeEnvironment } from "hardhat/types"
import _ from "lodash"
import { isString, isPlainObject, isNonEmptyString } from "../../utils/type"

type VIA_TYPE = 'EOA' | 'Contract' | 'Multisig' | 'Gnosis Safe' | 'Gnosis Multisig' | 'Unknown';
type DefenderOpts = {
  from?: string
  title?: string
  description?: string
  via?: string
  viaType?: VIA_TYPE
}

class DefenderWrapper extends MethodMissing {
  hre!: HardhatRuntimeEnvironment
  chainId!: string
  contractName!: string
  contract: any
  defender: DefenderUpgrader

  constructor() {
    super()
    const chainId = LOCAL_CHAIN_ID
    this.defender = new DefenderUpgrader({hre, logger: console.log, chainId: LOCAL_CHAIN_ID})
  }

  async initialize({contractName, logger}) {
    logger = logger || console.log
    const chainId = await this.hre.getChainId()
    this.hre = hre
    this.chainId = chainId
    this.contractName = contractName
    const deployed = await hre.deployments.get(contractName)
    this.contract = await artifacts.require(contractName).at(deployed.address)
    this.defender = new DefenderUpgrader({hre, logger, chainId})
  }

  __call(method, args) {
    const [opts, methodArgs] = this.getOptsAndArgs(args)
    const from = opts.from || this.contract.from
    if (!this.contract[method]) {
      throw new Error(`Unknown method ${method}`)
    } else {
      if (this.shouldUseDefender()) {
        return this.defender.send({
          method,
          args: methodArgs,
          contract: this.contract,
          contractName: this.contractName,
          title: `Call ${method} on ${this.contract}`,
          description: "",
          via: from,
          viaType: "Gnosis Safe"
        })
      } else {
        return this.contract[method].apply(this.contract, methodArgs)
      }
    }
  }

  at(address: string) {
    this.contract = artifacts.require(this.contractName).at(address)
  }

  getOptsAndArgs(args) : [DefenderOpts, unknown[]] {
    const lastArg = _.last(args)
    let methodArgs = args
    let opts: DefenderOpts
    if (this.isDefenderOpts(lastArg)) {
      methodArgs = _.slice(args, args.length - 1)
      opts = lastArg
    } else {
      methodArgs = args
      opts = {}
    }
    return [opts, methodArgs]
  }

  async send(method, args, opts?: DefenderOpts) {
    if (this.shouldUseDefender()) {
      return this.defender.send({
        method,
        args,
        contract: this.contract,
        contractName: this.contractName,
        title: opts?.title,
        description: opts?.description,
        via: opts?.via,
        viaType: opts?.viaType,
      })
    } else {
      return this.contract[method].apply(this.contract, args)
    }
  }

  shouldUseDefender() {
    return [MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID].includes(this.chainId)
  }

  isDefenderOpts(opts: unknown): opts is DefenderOpts {
    return isPlainObject(opts) &&
      (isNonEmptyString(opts.from) ||
        isString(opts.title) ||
        isString(opts.description) ||
        isNonEmptyString(opts.via) ||
        isNonEmptyString(opts.viaType))
  }
}

module.exports = DefenderWrapper
