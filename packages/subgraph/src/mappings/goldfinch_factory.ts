// Ideally this references utils with the @goldfinch-eng/utils alias. However, this project
// is in AssemblyScript and not Typescript. Task to fix this debt:
// https://linear.app/goldfinch/issue/GFI-851/allow-subgraph-project-to-use-typescript-aliases-defined-elsewhere
import {INVALID_POOLS} from "../../../utils/src/pools"
import {BorrowerCreated, PoolCreated} from "../../generated/GoldfinchFactory/GoldfinchFactory"
import {TranchedPool as TranchedPoolTemplate} from "../../generated/templates"
import {getOrInitBorrower} from "../entities/borrower"
import {getOrInitTranchedPool} from "../entities/tranched_pool"
import {addToListOfAllTranchedPools} from "../entities/protocol"

export function handlePoolCreated(event: PoolCreated): void {
  if (INVALID_POOLS.has(event.params.pool.toHexString())) {
    return
  }

  TranchedPoolTemplate.create(event.params.pool)
  getOrInitTranchedPool(event.params.pool, event.block.timestamp)
  addToListOfAllTranchedPools(event.params.pool)
}

export function handleBorrowerCreated(event: BorrowerCreated): void {
  getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}
