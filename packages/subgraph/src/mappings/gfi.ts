import {CapUpdated} from "../../generated/GFI/GFI"

import {updateGfiData} from "../entities/gfi"

export function handleCapUpdated(event: CapUpdated): void {
  updateGfiData(event.address)
}
