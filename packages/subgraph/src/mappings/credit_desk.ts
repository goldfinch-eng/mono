import {updateTotalDrawdowns} from "../entities/tranched_pool_roster"
import {DrawdownMade} from "../../generated/CreditDesk/CreditDesk"

export function handleDrawdownMade(event: DrawdownMade): void {
  updateTotalDrawdowns(event.params.drawdownAmount)
}
