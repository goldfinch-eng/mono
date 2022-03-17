import {TestFiduUSDCCurveLP} from "@goldfinch-eng/protocol/typechain/ethers"
import {TestFiduUSDCCurveLPInstance} from "@goldfinch-eng/protocol/typechain/truffle"
import {assertIsString} from "@goldfinch-eng/utils"
import BN from "bn.js"
import {getNamedAccounts} from "hardhat"
import {CONFIG_KEYS} from "../configKeys"
import {
  ContractDeployer,
  assertIsChainId,
  getProtocolOwner,
  getContract,
  TRUFFLE_CONTRACT_PROVIDER,
  updateConfig,
  MAINNET_FIDU_USDC_CURVE_LP_ADDRESS,
  isMainnetForking,
  LOCAL_CHAIN_ID,
} from "../deployHelpers"

const logger = console.log

export async function getOrDeployFiduUSDCCurveLP(deployer: ContractDeployer, config) {
  const {gf_deployer} = await getNamedAccounts()
  const chainId = await deployer.getChainId()
  assertIsChainId(chainId)
  let fiduUSDCCurveLPAddress = MAINNET_FIDU_USDC_CURVE_LP_ADDRESS
  const protocolOwner = await getProtocolOwner()
  if (chainId === LOCAL_CHAIN_ID && !isMainnetForking()) {
    logger("We don't have a FIDU-USDC Curve LP address for this network, so deploying a fake contract")
    const initialAmount = String(new BN("10000000000000").mul(new BN(String(1e18))))
    const decimalPlaces = String(new BN(18))
    assertIsString(gf_deployer)
    const fakeFiduUSDCCurveLPAddress = await deployer.deploy("TestFiduUSDCCurveLP", {
      from: gf_deployer,
      args: [initialAmount, decimalPlaces, config.address],
    })
    fiduUSDCCurveLPAddress = fakeFiduUSDCCurveLPAddress.address
    await (
      await getContract<TestFiduUSDCCurveLP, TestFiduUSDCCurveLPInstance>(
        "TestFiduUSDCCurveLP",
        TRUFFLE_CONTRACT_PROVIDER,
        {
          from: gf_deployer,
        }
      )
    ).transfer(protocolOwner, String(new BN(10000000000000).mul(new BN(String(1e18)))))
  }
  await updateConfig(config, "address", CONFIG_KEYS.FiduUSDCCurveLP, fiduUSDCCurveLPAddress, logger)
  return fiduUSDCCurveLPAddress
}
