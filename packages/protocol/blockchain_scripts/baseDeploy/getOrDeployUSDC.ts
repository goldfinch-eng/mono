import {TestERC20Instance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import BN from "bn.js"
import {getNamedAccounts} from "hardhat"
import {CONFIG_KEYS} from "../configKeys"
import {
  ContractDeployer,
  assertIsChainId,
  getUSDCAddress,
  getProtocolOwner,
  USDCDecimals,
  updateConfig,
  getTruffleContract,
} from "../deployHelpers"

const logger = console.log

export async function getOrDeployUSDC(deployer: ContractDeployer, config) {
  const {gf_deployer} = await getNamedAccounts()
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)
  let usdcAddress = getUSDCAddress(chainId)
  const protocolOwner = await getProtocolOwner()
  if (!usdcAddress) {
    logger("We don't have a USDC address for this network, so deploying a fake USDC")
    const initialAmount = String(new BN("100000000").mul(USDCDecimals))
    const decimalPlaces = String(new BN(6))
    assertIsString(gf_deployer)
    const fakeUSDC = await deployer.deploy("TestERC20", {
      from: gf_deployer,
      args: [initialAmount, decimalPlaces],
    })
    usdcAddress = fakeUSDC.address
    await (
      await getTruffleContract<TestERC20Instance>("TestERC20", {from: gf_deployer})
    ).transfer(protocolOwner, String(new BN(90000000).mul(USDCDecimals)))
  }
  await updateConfig(config, "address", CONFIG_KEYS.USDC, usdcAddress, logger)
  return usdcAddress
}
