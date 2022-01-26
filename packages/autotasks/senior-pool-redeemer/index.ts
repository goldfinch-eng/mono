import {BigNumber, ethers} from "ethers"
import {DefenderRelayProvider, DefenderRelaySigner} from "defender-relay-client/lib/ethers"
import SeniorPoolDeployment from "@goldfinch-eng/protocol/deployments/mainnet/SeniorPool.json"
import PoolTokensDeployment from "@goldfinch-eng/protocol/deployments/mainnet/PoolTokens.json"
import TranchedPoolDeploy from "@goldfinch-eng/protocol/deployments/mainnet/TranchedPool.json"
import {RelayerParams} from "defender-relay-client/lib/relayer"
import {SeniorPool, PoolTokens, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"

// Entrypoint for the Autotask
export async function handler(event: RelayerParams) {
  const provider = new DefenderRelayProvider(event as RelayerParams)
  const signer = new DefenderRelaySigner(event, provider, {speed: "safeLow"})
  const seniorPool = new ethers.Contract(SeniorPoolDeployment.address, SeniorPoolDeployment.abi, signer) as SeniorPool
  const poolTokens = new ethers.Contract(PoolTokensDeployment.address, PoolTokensDeployment.abi, provider) as PoolTokens

  console.log("👵  getting senior pool pool token minting events ")
  const tokenMintedBySeniorPoolFilter = poolTokens.filters.TokenMinted(seniorPool.address)
  const seniorPoolMintingEvents = await poolTokens.queryFilter(tokenMintedBySeniorPoolFilter)
  const poolsWithTokenIds: [string, string][] = seniorPoolMintingEvents.map((x) => [
    x.args[1] as string, // address
    (x.args[2] as BigNumber).toString(), // pool
  ])
  console.log(`✅  done getting minting events. Found ${poolsWithTokenIds.length}`)

  console.log("🧐  checking what tokensIds are redeemable")
  const activePoolTokens: string[] = (
    await Promise.all(
      poolsWithTokenIds.map(async ([address, tokenId]) => {
        console.log(` 🧐 checking tokenId = ${tokenId}, address = ${address}`)
        const tranchedPool = new ethers.Contract(address, TranchedPoolDeploy.abi, provider) as TranchedPool
        try {
          const availableToWithdraw = await tranchedPool.availableToWithdraw(tokenId)

          if (!availableToWithdraw.interestRedeemable.eq("0") || !availableToWithdraw.principalRedeemable.eq("0")) {
            console.log(` 🪙  adding tokenId = ${tokenId} from pool ${address} to redeem list`)
            return tokenId
          }
        } catch (e) {
          console.error(e)
        }
        return undefined
      })
    )
  ).filter((x) => x !== undefined) as string[]

  console.log(`✅  found ${activePoolTokens.length} redeemable tokens`)

  console.log("starting to redeem pool tokens")
  const successes = await Promise.all(
    activePoolTokens.map(async (tokenId: string) => {
      console.log(`🏦  trying to redeem token id = ${tokenId}...`)
      try {
        await (await seniorPool.redeem(tokenId)).wait()
        console.log(`✅  sucessfully redeemed token id = ${tokenId}!`)
        return true
      } catch (e) {
        console.error(`❌  failed to redeem token id = ${tokenId}!`)
        console.error(e)
        return false
      }
    })
  )

  if (!successes.every((x) => x === true)) {
    console.error("not all tokens successefully redeemed! Exiting as failure...")
    process.exit(1)
  }

  console.log("success!")
}

// To run locally (this code will not be executed in Autotasks)
// Invoke with: API_KEY=<key> API_SECRET=<secret>
if (require.main === module) {
  const {API_KEY: apiKey, API_SECRET: apiSecret} = process.env
  exports
    .handler({apiKey, apiSecret})
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
