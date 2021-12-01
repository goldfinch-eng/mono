import { TranchedPool as TranchedPoolTemplate } from "../../generated/templates"
import { PoolCreated } from "../../generated/GoldfinchFactoryProxy/GoldfinchFactory"

export function handlerPoolCreated(event: PoolCreated): void {
  TranchedPoolTemplate.create(event.params.pool)
}
