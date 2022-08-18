import hre from "hardhat"
import {assertNonNullable} from "packages/utils/src/type"
const {getNamedAccounts, ethers} = hre

async function main() {
  const {protocol_owner} = await getNamedAccounts()
  assertNonNullable(protocol_owner, "protocol_owner is null")
  const chainId = parseInt(await hre.getChainId())
  assertNonNullable(process.env.NONCE, "You must provide NONCE as an envvar")
  assertNonNullable(process.env.MAINNET_GF_DEPLOYER_KEY, "You must provide MAINNET_GF_DEPLOYER_KEY as an envvar")
  const nonce = parseInt(process.env.NONCE, 10)
  const gasPrice = process.env.GAS_PRICE || "40"

  const signer = await hre.ethers.getSigner(protocol_owner)

  await cancelTransaction(nonce, gasPrice)

  async function cancelTransaction(nonce, gasPrice) {
    const tx = {
      to: protocol_owner,
      value: ethers.utils.parseEther("0.00"),
      chainId,
      nonce,
      gasPrice: ethers.utils.parseUnits(gasPrice, "gwei"),
    }
    console.log("Sending transaction...", tx)
    const txn = await signer.sendTransaction(tx)
    console.log("Txn is:", txn, "now waiting...")
    await txn.wait()
  }
}

if (require.main === module) {
  // If this is run as a script, then call main. If it's imported (for tests), this block will not run
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export default main
