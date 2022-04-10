import {Address} from "@graphprotocol/graph-ts"
import {GFI as GFIContract} from "../../generated/GFI/GFI"
import {GFIData as GFIEntity} from "../../generated/schema"

const GFI_ENTITY_ID = "1"

export function getGfiEntity(): GFIEntity {
  let gfiEntity = GFIEntity.load(GFI_ENTITY_ID)
  if (!gfiEntity) {
    gfiEntity = new GFIEntity(GFI_ENTITY_ID)
  }
  return gfiEntity
}

export function updateGfiData(contractAddress: Address): void {
  const gfiContract = GFIContract.bind(contractAddress)
  const gfiEntity = getGfiEntity()
  gfiEntity.contractAddress = contractAddress.toHexString()
  gfiEntity.totalSupply = gfiContract.totalSupply()
  gfiEntity.save()
}
