// Ideally this references utils with the @goldfinch-eng/utils alias. However, this project
// is in AssemblyScript and not Typescript. Task to fix this debt:
// https://linear.app/goldfinch/issue/GFI-851/allow-subgraph-project-to-use-typescript-aliases-defined-elsewhere
import {INVALID_POOLS} from "../../../utils/src/pools"
import {BorrowerCreated, CallableLoanCreated, PoolCreated} from "../../generated/GoldfinchFactory/GoldfinchFactory"
import {TranchedPool as TranchedPoolTemplate, CallableLoan as CallableLoanTemplate} from "../../generated/templates"
import {getOrInitBorrower} from "../entities/borrower"
import {getOrInitTranchedPool} from "../entities/tranched_pool"
import {addToListOfAllLoans} from "../entities/protocol"
import {initCallableLoan} from "./callable_loan/helpers"

export function handlePoolCreated(event: PoolCreated): void {
  if (INVALID_POOLS.has(event.params.pool.toHexString())) {
    return
  }

  TranchedPoolTemplate.create(event.params.pool)
  getOrInitTranchedPool(event.params.pool, event.block.timestamp)
  addToListOfAllLoans(event.params.pool)
}

export function handleBorrowerCreated(event: BorrowerCreated): void {
  getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}

export function handleCallableLoanCreated(event: CallableLoanCreated): void {
  CallableLoanTemplate.create(event.params.loan)
  const callableLoan = initCallableLoan(event.params.loan, event.block)
  callableLoan.save()
  addToListOfAllLoans(event.params.loan)
}
