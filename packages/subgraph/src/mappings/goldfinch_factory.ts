// Ideally this references utils with the @goldfinch-eng/utils alias. However, this project
// is in AssemblyScript and not Typescript. Task to fix this debt:
// https://linear.app/goldfinch/issue/GFI-851/allow-subgraph-project-to-use-typescript-aliases-defined-elsewhere
import {INVALID_POOLS} from "../../../utils/src/pools"
import {TranchedPool as TranchedPoolTemplate} from "../../generated/templates"
import {getOrInitTranchedPool} from "../entities/tranched_pool"
import {BorrowerCreated, PoolCreated} from "../../generated/GoldfinchFactory/GoldfinchFactory"
import {getOrInitBorrower} from "../entities/borrower"

export function handlePoolCreated(event: PoolCreated): void {
  if (INVALID_POOLS.has(event.params.pool.toHexString())) {
    return
  }

  TranchedPoolTemplate.create(event.params.pool)
  getOrInitTranchedPool(event.params.pool, event.block.timestamp)
}

export function handleBorrowerCreated(event: BorrowerCreated): void {
  getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}
