import {DeployOptions, DeployResult} from "hardhat-deploy/types"

import {GoldfinchConfig} from "../typechain/ethers"
import {DeployEffects} from "./migrations/deployEffects"

export type Logger = typeof console.log
export type DeployFn = (name: string, options: DeployOptions) => Promise<DeployResult>
export type DeployOpts = {config: GoldfinchConfig; deployEffects?: DeployEffects}

export type Awaited<T> = T extends PromiseLike<infer U> ? U : T
