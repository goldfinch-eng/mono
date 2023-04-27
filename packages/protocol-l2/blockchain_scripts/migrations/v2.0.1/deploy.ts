import {ContractDeployer, ETHDecimals, getTempMultisig} from "../../deployHelpers"
import hre, {ethers} from "hardhat"
import {DeployEffects} from "../deployEffects"
import {assertIsString} from "packages/utils/src/type"
import {GFI} from "packages/protocol/typechain/ethers/contracts/protocol/core/GFI"
import {BN} from "ethereumjs-tx/node_modules/ethereumjs-util"

export async function deploy(deployEffects: DeployEffects) {
  const deployer = new ContractDeployer(console.log, hre)
  const {gf_deployer} = await hre.getNamedAccounts()
  console.log("About to deploy GFI...")
  const provider = ethers.getDefaultProvider()
  const gasPrice = await provider.getGasPrice()
  const gasPriceToUse = gasPrice.mul("12").div("10")
  assertIsString(gf_deployer)
  // 100M
  const initialCap = new BN(100_000_000).mul(ETHDecimals)

  // Temp Multisig used for anonymity
  const owner = await getTempMultisig()
  console.log("deploying from:", gf_deployer)
  const gfi = await deployer.deploy<GFI>("GFI", {
    from: gf_deployer,
    gasLimit: 2000000,
    gasPrice: gasPriceToUse,
    args: [
      owner, // owner
      "Goldfinch", // name
      "GFI", // symbol
      String(initialCap), //initialCap
    ],
  })
  console.log("deployed to:", gfi.address)

  return {
    deployedContracts: {
      gfi,
    },
  }
}
