import {bufferToHex, keccak256} from "ethereumjs-util"
import {assertNonNullable, assertNumber} from "@goldfinch-eng/utils"

export default class MerkleTree {
  private readonly elements: Buffer[]
  private readonly bufferElementPositionIndex: {[hexElement: string]: number}
  private readonly layers: Buffer[][]

  constructor(elements: Buffer[]) {
    this.elements = [...elements]
    // Sort elements
    this.elements.sort(Buffer.compare)
    // Deduplicate elements
    this.elements = MerkleTree.bufDedup(this.elements)

    this.bufferElementPositionIndex = this.elements.reduce<{[hexElement: string]: number}>((memo, el, index) => {
      memo[bufferToHex(el)] = index
      return memo
    }, {})

    // Create layers
    this.layers = this.getLayers(this.elements)
  }

  getLayers(elements: Buffer[]): Buffer[][] {
    if (elements.length === 0) {
      throw new Error("empty tree")
    }

    const layers: Buffer[][] = []
    layers.push(elements)

    // Get next layer until we reach the root
    let _layer: Buffer[] | undefined = layers[layers.length - 1]
    assertNonNullable(_layer)
    let layer: Buffer[] = _layer
    while (layer.length > 1) {
      layers.push(this.getNextLayer(layer))

      _layer = layers[layers.length - 1]
      assertNonNullable(_layer)
      layer = _layer
    }

    return layers
  }

  getNextLayer(elements: Buffer[]): Buffer[] {
    return elements.reduce<Buffer[]>((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(MerkleTree.combinedHash({first: el, second: arr[idx + 1]}))
      }

      return layer
    }, [])
  }

  static combinedHash(
    pair: {first: Buffer; second: Buffer} | {first: undefined; second: Buffer} | {first: Buffer; second: undefined}
  ): Buffer {
    if (!pair.first) {
      return pair.second
    }
    if (!pair.second) {
      return pair.first
    }

    return keccak256(MerkleTree.sortAndConcat(pair.first, pair.second))
  }

  getRoot(): Buffer {
    const lastLayer = this.layers[this.layers.length - 1]
    assertNonNullable(lastLayer)
    const root = lastLayer[0]
    assertNonNullable(root)
    return root
  }

  getHexRoot(): string {
    return bufferToHex(this.getRoot())
  }

  getProof(el: Buffer) {
    let idx = this.bufferElementPositionIndex[bufferToHex(el)]

    if (typeof idx !== "number") {
      throw new Error("Element does not exist in Merkle tree")
    }

    return this.layers.reduce((proof, layer) => {
      assertNumber(idx)
      const pairElement = MerkleTree.getPairElement(idx, layer)

      if (pairElement) {
        proof.push(pairElement)
      }

      idx = Math.floor(idx / 2)

      return proof
    }, [])
  }

  getHexProof(el: Buffer): string[] {
    const proof = this.getProof(el)

    return MerkleTree.bufArrToHexArr(proof)
  }

  private static getPairElement(idx: number, layer: Buffer[]): Buffer | null {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1

    if (pairIdx < layer.length) {
      const pairEl = layer[pairIdx]
      assertNonNullable(pairEl)
      return pairEl
    } else {
      return null
    }
  }

  private static bufDedup(elements: Buffer[]): Buffer[] {
    return elements.filter((el, idx): boolean => {
      if (idx) {
        const prevEl = elements[idx - 1]
        assertNonNullable(prevEl)
        return !prevEl.equals(el)
      } else {
        return true
      }
    })
  }

  private static bufArrToHexArr(arr: Buffer[]): string[] {
    if (arr.some((el) => !Buffer.isBuffer(el))) {
      throw new Error("Array is not an array of buffers")
    }

    return arr.map((el) => "0x" + el.toString("hex"))
  }

  private static sortAndConcat(...args: Buffer[]): Buffer {
    return Buffer.concat([...args].sort(Buffer.compare))
  }
}
