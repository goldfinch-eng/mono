import {TranchedPool as TranchedPoolTemplate} from "../../generated/templates"
import {getOrInitTranchedPool} from "../entities/tranched_pool"
import {PoolCreated} from "../../generated/templates/GoldfinchFactory/GoldfinchFactory"

// These are some bogus pools that exist on mainnet, but they aren't real so they should be excluded from the subgraph
const excludedPools = [
  "0x0e2e11dc77bbe75b2b65b57328a8e4909f7da1eb",
  "0x4b2ae066681602076adbe051431da7a3200166fd",
  "0x6b42b1a43abe9598052bb8c21fd34c46c9fbcb8b",
  "0x7bdf2679a9f3495260e64c0b9e0dfeb859bad7e0",
  "0x95715d3dcbb412900deaf91210879219ea84b4f8",
  "0xa49506632ce8ec826b0190262b89a800353675ec",
  "0xfce88c5d0ec3f0cb37a044738606738493e9b450",
]

export function handlePoolCreated(event: PoolCreated): void {
  if (excludedPools.includes(event.params.pool.toHexString())) {
    return
  }
  TranchedPoolTemplate.create(event.params.pool)
  getOrInitTranchedPool(event.params.pool, event.block.timestamp)
}
