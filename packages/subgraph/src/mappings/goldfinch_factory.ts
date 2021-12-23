import { TranchedPool as TranchedPoolTemplate } from "../../generated/templates"
import { getOrInitTranchedPool } from "../entities/tranched_pool"
import { PoolCreated } from "../../generated/GoldfinchFactoryProxy/GoldfinchFactory"

export function handlePoolCreated(event: PoolCreated): void {
  TranchedPoolTemplate.create(event.params.pool)
  getOrInitTranchedPool(event.params.pool)
}
