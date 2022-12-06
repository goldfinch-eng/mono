import {SeniorPoolWithdrawalRequestRoster} from "../../generated/schema"

export function getOrInitSeniorPoolWithdrawalRoster(): SeniorPoolWithdrawalRequestRoster {
  let roster = SeniorPoolWithdrawalRequestRoster.load("1")
  if (!roster) {
    roster = new SeniorPoolWithdrawalRequestRoster("1")
    roster.requests = []
  }
  return roster
}
