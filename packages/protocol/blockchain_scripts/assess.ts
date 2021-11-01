import {getContract, TRUFFLE_CONTRACT_PROVIDER} from "./deployHelpers"
import {assertNonNullable} from "@goldfinch-eng/utils"
import {CreditLineInstance, TranchedPoolInstance} from "../typechain/truffle"
import {CreditLine, TranchedPool} from "../typechain/ethers"

async function main() {
  assertNonNullable(process.env.POOL)
  const poolAddress = process.env.POOL
  const pool = await getContract<TranchedPool, TranchedPoolInstance>("TranchedPool", TRUFFLE_CONTRACT_PROVIDER, {
    at: poolAddress,
  })
  const creditLine = await getContract<CreditLine, CreditLineInstance>("CreditLine", TRUFFLE_CONTRACT_PROVIDER, {
    at: await pool.creditLine(),
  })
  await pool.assess()

  console.log("new interest owed", (await creditLine.interestOwed()).toString())
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
