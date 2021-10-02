import {isMainnet} from "./deployHelpers"
import {ethers} from "hardhat"
import {assertNonNullable} from "@goldfinch-eng/utils"
async function main() {
  const amountToSend = process.env.AMOUNT_TO_SEND
  const addressToSendTo = process.env.RECIPIENT
  if (!(await isMainnet())) {
    throw new Error("This only works for mainnet right now")
  }
  if (!addressToSendTo) {
    throw new Error("You must pass an address to send to")
  }
  await sendETH(amountToSend, addressToSendTo)

  async function sendETH(amountToSend, addressToSendTo) {
    const value = ethers.utils.parseEther(amountToSend)
    const tx = {
      to: addressToSendTo,
      value: value,
      chainId: 1,
    }
    assertNonNullable(process.env.MAINNET_PROXY_OWNER_KEY)
    const wallet = new ethers.Wallet(process.env.MAINNET_PROXY_OWNER_KEY, ethers.getDefaultProvider())
    console.log("Sending transaction...", tx, "with value of", String(value))
    const txn = await wallet.sendTransaction(tx)
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
