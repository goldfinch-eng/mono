import {CreditLine, GoldfinchFactory, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import {getEthersContract} from "../../deployHelpers"
import {getDeployEffects} from "../deployEffects"

export const repaidPoolAddressesToPauseDrawdowns: string[] = [
  "0x67df471eacd82c3dbc95604618ff2a1f6b14b8a1", // almavest #1
  "0x1e73b5c1a3570b362d46ae9bf429b25c05e514a7", // payjoy
  "0xd798d527f770ad920bb50680dbc202bb0a1dafd6", // quickcheck #1
  "0x2107ade0e536b8b0b85cca5e0c0c3f66e58c053c", // quickcheck #2
  "0xf74ea34ac88862b7ff419e60e476be2651433e68", // divibank
].map((x) => x.toLowerCase())

const formatEtherscanLink = (address) => `https://etherscan.io/address/${address}`

export async function getPoolAddressesToPause(): Promise<string[]> {
  const goldfinchFactory = await getEthersContract<GoldfinchFactory>("GoldfinchFactory")
  const filter = goldfinchFactory.filters.PoolCreated()
  const events = await goldfinchFactory.queryFilter(filter)
  const poolAddresses = events.map((e) => e.args.pool)

  const poolAddressHasZeroBalance = async (address) => {
    const pool = await getEthersContract<TranchedPool>("TranchedPool", {at: address})
    const creditLine = await getEthersContract<CreditLine>("CreditLine", {at: await pool.creditLine()})
    const balance = await creditLine.balance()
    return balance.isZero()
  }

  const pools: string[] = []
  for (const address of poolAddresses) {
    if (await poolAddressHasZeroBalance(address)) {
      pools.push(address.toLowerCase())
    }
  }

  // we need to dedupli
  const allPools = [...new Set([...pools, ...repaidPoolAddressesToPauseDrawdowns])]

  return allPools
}

export async function main() {
  const poolAddressesToPause = await getPoolAddressesToPause()

  const description = [
    ...poolAddressesToPause.map((address) => `call \`.pauseDrawdowns()\` ${formatEtherscanLink(address)}`),
    "pull request: https://github.com/warbler-labs/mono/pull/367",
  ].join("\n")

  const effects = await getDeployEffects({
    title: "v2.4.1 proposal to pause drawdowns on paid down pools",
    description: description,
  })

  const poolContracts = await Promise.all(
    poolAddressesToPause.map(async (address) => await getEthersContract<TranchedPool>("TranchedPool", {at: address}))
  )
  const pauseDrawdownsTransactions = await Promise.all(
    poolContracts.map(async (pool) => await pool.populateTransaction.pauseDrawdowns())
  )

  effects.add({deferred: pauseDrawdownsTransactions})

  await effects.executeDeferred()
  return {}
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
