import * as dotenv from "dotenv"
dotenv.config({path: ".env.local"})
import {fromAtomic, getContract} from "./deployHelpers"
import {SeniorPoolInstance, PoolTokensInstance, TranchedPoolInstance} from "../typechain/truffle"
import {default as DefenderProposer} from "./DefenderProposer"
import hre from "hardhat"

async function main() {
  const seniorPool = (await getContract("SeniorPool")) as SeniorPoolInstance
  const poolTokens = (await getContract("PoolTokens")) as PoolTokensInstance
  const {getChainId} = hre
  const chainId = await getChainId()
  const poolProposer = new RedeemTranchedPoolProposer({hre, logger: console.log, chainId})

  const events = await poolTokens.getPastEvents("TokenMinted", {
    filter: {owner: seniorPool.address},
    fromBlock: "earliest",
    toBlock: "latest",
  })
  console.log(`Found ${events.length} tokens for the senior pool`)

  for (const event of events) {
    const tokenId = event.args.tokenId
    const poolAddress = event.args.pool
    const tranchedPool = (await getContract("TranchedPool", {at: poolAddress})) as TranchedPoolInstance
    let interest
    let principal

    try {
      const res = await tranchedPool.availableToWithdraw(tokenId)
      interest = res[0]
      principal = res[1]
    } catch (ex) {
      console.log(`Failed to calculate for ${poolAddress} (${ex.message})`)
      continue
    }

    if (!interest.isZero() || !principal.isZero()) {
      console.log(`Redeeming $${fromAtomic(interest.add(principal))} via token ${tokenId} on ${poolAddress}`)
      await poolProposer.proposeRedeem(seniorPool.address, tokenId)
    }
  }
}

class RedeemTranchedPoolProposer extends DefenderProposer {
  async proposeRedeem(seniorPool, tokenId) {
    await this.client.createProposal({
      contract: {address: seniorPool, network: this.network as any}, // Target contract
      title: "SeniorPool Redeem",
      description: `Redeem token ${tokenId} on the senior pool`,
      type: "custom",
      functionInterface: {
        name: "redeem",
        inputs: [
          {
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
        ],
      },
      functionInputs: [tokenId.toString()],
      via: this.safeAddress,
      viaType: "Gnosis Safe", // Either Gnosis Safe or Gnosis Multisig
    })
    this.logger("Defender URL: ", this.defenderUrl(seniorPool))
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
