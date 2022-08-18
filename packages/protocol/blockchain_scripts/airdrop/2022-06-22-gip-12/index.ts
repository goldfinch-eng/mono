import {BigNumber} from "ethers/lib/ethers"
import addressesAndAmounts from "./addressAndAmounts.json"
import airdropGFI from "../common/airdropGFI"

async function main() {
  await airdropGFI({
    title: "GIP-12 GFI Airdrop",
    description:
      "Compensate users who received fewer GFI rewards due to StakingRewards bug. https://snapshot.org/#/goldfinch.eth/proposal/0xd84660773a722e8bd13c4f1f10fe33e853475e4b990f9e058647ec7002aee6f4",
    addressesAndAmounts: addressesAndAmounts.map(({address, amount}) => ({
      address,
      amount: BigNumber.from(String(amount)),
    })),
    dryRun: false,
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
