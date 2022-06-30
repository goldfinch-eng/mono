import {BigNumber} from "ethers/lib/ethers"
import {getEthersContract, getProtocolOwner} from "../../deployHelpers"
import {getDeployEffects} from "../../migrations/deployEffects"
import {GFI} from "@goldfinch-eng/protocol/typechain/ethers"

const GFI_ADDRESS = "0xdab396ccf3d84cf2d07c4454e10c8a6f5b008d2b"

type AddressAndAmount = {
  address: string
  amount: BigNumber
}

export default async function airdropGFI({
  title,
  description,
  addressesAndAmounts,
  dryRun = true,
}: {
  title: string
  description: string
  addressesAndAmounts: AddressAndAmount[]
  dryRun?: boolean
}): Promise<void> {
  console.log("Executing GFI airdrop...")
  if (dryRun) {
    console.log("This is a dry run. Set `dryRun` to false after confirming successful transactions on Tenderly.")
  }

  const effects = await getDeployEffects({title, description})
  const gfi = await getEthersContract<GFI>("GFI", {
    at: GFI_ADDRESS,
    from: await getProtocolOwner(),
  })

  const populatedTransactions = await Promise.all(
    addressesAndAmounts.map(({address, amount}) => gfi.populateTransaction.transfer(address, amount))
  )

  effects.add({deferred: populatedTransactions})
  await effects.executeDeferred({dryRun})
}
