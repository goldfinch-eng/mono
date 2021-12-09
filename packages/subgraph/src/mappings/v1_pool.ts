import { DepositMade } from "../../generated/templates/Pool/Pool"

import {handleDepositForV1} from "../entities/user"

export function handleDepositMade(event: DepositMade): void {
  handleDepositForV1(event)
}
