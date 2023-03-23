import {ethers} from "ethers"
import {DefenderRelayProvider, DefenderRelaySigner} from "defender-relay-client/lib/ethers"
import SeniorPoolDeployment from "@goldfinch-eng/protocol/deployments/mainnet/SeniorPool.json"
import PoolTokensDeployment from "@goldfinch-eng/protocol/deployments/mainnet/PoolTokens.json"
import TranchedPoolDeploy from "@goldfinch-eng/protocol/deployments/mainnet/TranchedPool.json"
import {RelayerParams} from "defender-relay-client/lib/relayer"
import {SeniorPool, PoolTokens, TranchedPool} from "@goldfinch-eng/protocol/typechain/ethers"
import baseHandler from "../core/handler"

class MultiError extends Error {
  private errors: any[]

  constructor(message: string, ...errors: any[]) {
    super(message)
    this.errors = errors
  }
}

// These are tokens that shouldn't be considered for redemption
const tokenIgnoreList = [
  // This token was created on an initial funding of the senior pool for
  // Almavest Basket #6. The senior pool was inadvertantly withdrawn by an older
  // version of this script. There's a bug in the script that's causing an underflow
  // thats being caught by safe math. There's no principal to be redeemed from this token
  // so we're going to ignore it
  604,
]

// Entrypoint for the Autotask
export const handler = baseHandler("senior-pool-redeemer", async (event: RelayerParams) => {
  const provider = new DefenderRelayProvider(event as RelayerParams)
  const signer = new DefenderRelaySigner(event, provider, {speed: "fast"})
  const seniorPool = new ethers.Contract(SeniorPoolDeployment.address, SeniorPoolDeployment.abi, signer) as SeniorPool
  const poolTokens = new ethers.Contract(PoolTokensDeployment.address, PoolTokensDeployment.abi, provider) as PoolTokens

  console.log("👵  getting senior pool pool token minting events ")
  const tokenMintedBySeniorPoolFilter = poolTokens.filters.TokenMinted(seniorPool.address)
  const seniorPoolMintingEvents = await poolTokens.queryFilter(tokenMintedBySeniorPoolFilter)
  const poolsWithTokenIds = seniorPoolMintingEvents.map((x) => ({
    poolAddress: x.args.pool,
    tokenId: x.args.tokenId,
    trancheId: x.args.tranche,
  }))
  console.log(`✅  done getting minting events. Found ${poolsWithTokenIds.length}`)

  console.log("🧐  checking what tokensIds are redeemable")
  const activePoolTokens: string[] = (
    await Promise.all(
      poolsWithTokenIds.map(async ({poolAddress, tokenId, trancheId}) => {
        const tokenIsOnIgnoreList = tokenIgnoreList.indexOf(tokenId.toNumber()) !== -1
        if (tokenIsOnIgnoreList) {
          console.log(` 🙈 ignoring tokenId = ${tokenId}: found on the ignore list`)
          return
        }

        console.log(` 🧐 checking tokenId = ${tokenId}, address = ${poolAddress}`)
        const tranchedPool = new ethers.Contract(poolAddress, TranchedPoolDeploy.abi, provider) as TranchedPool
        try {
          const [interestRedeemable, principalRedeemable] = await tranchedPool.availableToWithdraw(tokenId)
          const tranche = await tranchedPool.getTranche(trancheId)
          const lockedUntil = tranche.lockedUntil
          const trancheHasntBeenLocked = lockedUntil.isZero()

          if (trancheHasntBeenLocked) {
            console.log(`🪙❌ tokenId = ${tokenId} hasn't drawndown yet. Skipping`)
            return undefined
          }

          if (!interestRedeemable.eq("0") || !principalRedeemable.eq("0")) {
            console.log(` 🪙  adding tokenId = ${tokenId} from pool ${poolAddress} to redeem list`)
            return tokenId.toString()
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
  const errors: any[] = []
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
        errors.push(e)
        return false
      }
    })
  )

  if (!successes.every((x) => x === true)) {
    console.error("not all tokens successfully redeemed! Exiting as failure...")
    throw new MultiError("not all tokens successfully redeemed", errors)
  }

  console.log("success!")
})

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
