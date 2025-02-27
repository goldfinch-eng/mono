import {GoldfinchConfig, TestERC20} from "@goldfinch-eng/goldfinch-prime/typechain/ethers"
import BN from "bn.js"

import {CONFIG_KEYS} from "../configKeys"
import {
  ContractDeployer,
  assertIsChainId,
  getUSDCAddress,
  getProtocolOwner,
  USDCDecimals,
  updateConfig,
  getAccounts,
  getEthersContract,
} from "../deployHelpers"
import {DeployEffects} from "../migrations/deployEffects"

export async function getOrDeployUSDC(
  deployer: ContractDeployer,
  deployEffects: DeployEffects,
  config: GoldfinchConfig
) {
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)
  let usdcAddress = getUSDCAddress(chainId)

  if (!usdcAddress) {
    const {gf_deployer} = await getAccounts()
    const protocolOwner = await getProtocolOwner()

    console.log("We don't have a USDC address for this network, so deploying a fake USDC")
    const initialAmount = String(new BN("100000000").mul(USDCDecimals))
    const decimalPlaces = String(new BN(6))

    const fakeUSDC = await deployer.deploy("TestERC20", {
      from: gf_deployer,
      args: [initialAmount, decimalPlaces],
    })
    usdcAddress = fakeUSDC.address
    await (
      await getEthersContract<TestERC20>("TestERC20", {from: gf_deployer})
    ).transfer(protocolOwner, String(new BN(90000000).mul(USDCDecimals)))
  }

  await updateConfig(config, deployEffects, "address", CONFIG_KEYS.USDC, usdcAddress, console.log)

  return usdcAddress
}
