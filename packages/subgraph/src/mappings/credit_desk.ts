import {updateTotalDrawdowns} from "../entities/protocol"
import {DrawdownMade} from "../../generated/CreditDesk/CreditDesk"

export function handleDrawdownMade(event: DrawdownMade): void {
  updateTotalDrawdowns(event.params.drawdownAmount)
}
