import {GfiGrant} from "../../generated/schema"
import {Granted} from "../../generated/templates/CommunityRewards/CommunityRewards"

export function handleGranted(event: Granted): void {
  let gfiGrant = GfiGrant.load(event.params.tokenId.toString())
  if (!gfiGrant) {
    // throw new Error("Got a grant from an unknown source")
  }
}
