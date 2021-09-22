import {DefenderUpgrader} from "./defenderUpgrader.js"
import hre from "hardhat"
const {artifacts} = hre
import {getContract, MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID, TRUFFLE_CONTRACT_PROVIDER} from "../deployHelpers"
import MethodMissing from "method-missing"
import {HardhatRuntimeEnvironment} from "hardhat/types"
import _ from "lodash"
import {isString, isPlainObject, isNonEmptyString} from "@goldfinch-eng/utils"

type VIA_TYPE = "EOA" | "Contract" | "Multisig" | "Gnosis Safe" | "Gnosis Multisig" | "Unknown"
type DefenderOpts = {
  from?: string
  title?: string
  description?: string
  via?: string
  viaType?: VIA_TYPE
  metadata?: object
}

/*
THIS IS UNFINISHED. AS IS IT DOES NOT WORK.
It's fairly close though, and it could be pretty cool,
So I'm leaving it in. The idea is that you can wrap a contract,
and call methods on it, and it will transparently know whether to call
the "regular" method, or to create a Defender proposal. For example...

```
const wrappedPool = await new DefenderWrapper().initialize("SeniorPool")

// If you were on mainnet forking, this would call through.
// But if you were actually on mainnet, it would create a defender proposal
await wrappedPool.pause()
```

In theory this works by leveraging the MethodMissing extension, which catches
all methods, and then allows us to smartly route them to either Defender or the contract.
*/
class DefenderWrapper extends MethodMissing {
  hre!: HardhatRuntimeEnvironment
  chainId!: string
  contractName!: string
  contract: any
  defender!: DefenderUpgrader

  async initialize(contractName, opts) {
    const logger = console.log
    const chainId = await hre.getChainId()
    this.hre = hre
    this.chainId = chainId
    this.contractName = contractName
    this.contract = await getContract(contractName, TRUFFLE_CONTRACT_PROVIDER, opts)
    this.defender = new DefenderUpgrader({hre, logger, chainId})
    return this
  }

  __call(method, args) {
    if (method === "then") {
      return this[method](...args)
    }
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
          title: `Call ${method} on ${this.contract.address}`,
          description: "",
          via: from,
          viaType: "Gnosis Safe",
          metadata: opts.metadata,
        })
      } else {
        return this.contract[method](...methodArgs)
      }
    }
  }

  at(address: string) {
    this.contract = artifacts.require(this.contractName).at(address)
  }

  getOptsAndArgs(args): [DefenderOpts, unknown[]] {
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
      return this.contract[method](...args)
    }
  }

  shouldUseDefender() {
    return [MAINNET_CHAIN_ID, RINKEBY_CHAIN_ID].includes(this.chainId)
  }

  isDefenderOpts(opts: unknown): opts is DefenderOpts {
    return (
      isPlainObject(opts) &&
      (isNonEmptyString(opts.from) ||
        isString(opts.title) ||
        isString(opts.description) ||
        isNonEmptyString(opts.via) ||
        isNonEmptyString(opts.viaType))
    )
  }
}

module.exports = DefenderWrapper
