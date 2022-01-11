import {DeployOptions, DeployResult} from "hardhat-deploy/types"
import {Fidu, GoldfinchConfig} from "../typechain/ethers"

export type Logger = typeof console.log
export type DeployFn = (name: string, options: DeployOptions) => Promise<DeployResult>
export type DeployOpts = {config: GoldfinchConfig; fidu?: Fidu}

export type Awaited<T> = T extends PromiseLike<infer U> ? U : T
