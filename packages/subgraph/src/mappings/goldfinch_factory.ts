import { TranchedPool as TranchedPoolTemplate } from "../../generated/templates"
import {
  BorrowerCreated,
  Paused,
  PoolCreated,
  RoleGranted,
  RoleRevoked,
  Unpaused,
} from "../../generated/GoldfinchFactoryProxy/GoldfinchFactory"

export function handlerBorrowerCreated(event: BorrowerCreated): void {}

export function handlerPaused(event: Paused): void {}

export function handlerPoolCreated(event: PoolCreated): void {
  TranchedPoolTemplate.create(event.params.pool)
}

export function handlerRoleGranted(event: RoleGranted): void {}

export function handlerRoleRevoked(event: RoleRevoked): void {}

export function handlerUnpaused(event: Unpaused): void {}
