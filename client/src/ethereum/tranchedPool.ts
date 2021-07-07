import { GoldfinchProtocol } from "./GoldfinchProtocol"
import { TranchedPool as TranchedPoolContract } from "../typechain/web3/TranchedPool"

interface MetadataStore {
  [address: string]: PoolMetadata
}
let _metadataStore: MetadataStore
async function metadataStore(networkId: string): Promise<MetadataStore> {
  if (_metadataStore) {
    return Promise.resolve(_metadataStore)
  }
  try {
    let result = await import(`../../config/pool-metadata/${networkId}.json`)
    _metadataStore = result
    return _metadataStore
  } catch (e) {
    console.log(e)
    return {}
  }
}

interface PoolMetadata {
  name: string
  category: string
  icon: string
}

class TranchedPool {
  address: string
  goldfinchProtocol: GoldfinchProtocol
  contract: TranchedPoolContract
  creditLineAddress!: string
  metadata?: PoolMetadata

  constructor(address: string, goldfinchProtocol: GoldfinchProtocol) {
    this.address = address
    this.goldfinchProtocol = goldfinchProtocol
    this.contract = this.goldfinchProtocol.getContract<TranchedPoolContract>("TranchedPool", address)
  }

  async initialize() {
    this.creditLineAddress = await this.contract.methods.creditLine().call()
    this.metadata = await this.loadPoolMetadata()
  }

  private async loadPoolMetadata(): Promise<PoolMetadata | undefined> {
    let store = await metadataStore(this.goldfinchProtocol.networkId)
    return store[this.address.toLowerCase()]
  }
}

export { TranchedPool }
