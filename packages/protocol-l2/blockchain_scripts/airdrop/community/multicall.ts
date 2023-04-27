import {FunctionFragment} from "@ethersproject/abi"
import hre from "hardhat"
const {ethers} = hre
import {asNonNullable, assertNonNullable} from "@goldfinch-eng/utils"
import {CallOverrides, utils} from "ethers"
import BigNumber from "bignumber.js"

const multicallAbi = [
  {
    constant: true,
    inputs: [
      {
        components: [
          {
            internalType: "address",
            name: "target",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
          },
        ],
        internalType: "struct Multicall.Call[]",
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate",
    outputs: [
      {
        internalType: "uint256",
        name: "blockNumber",
        type: "uint256",
      },
      {
        internalType: "bytes[]",
        name: "returnData",
        type: "bytes[]",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "uint256",
        name: "blockNumber",
        type: "uint256",
      },
    ],
    name: "getBlockHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "blockHash",
        type: "bytes32",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getCurrentBlockCoinbase",
    outputs: [
      {
        internalType: "address",
        name: "coinbase",
        type: "address",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getCurrentBlockDifficulty",
    outputs: [
      {
        internalType: "uint256",
        name: "difficulty",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getCurrentBlockGasLimit",
    outputs: [
      {
        internalType: "uint256",
        name: "gaslimit",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getCurrentBlockTimestamp",
    outputs: [
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        internalType: "address",
        name: "addr",
        type: "address",
      },
    ],
    name: "getEthBalance",
    outputs: [
      {
        internalType: "uint256",
        name: "balance",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getLastBlockHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "blockHash",
        type: "bytes32",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
]

export interface Call {
  target: string
  call: FunctionFragment
  args: any[]
}

export interface MulticallResult<T = utils.Result> {
  blockNumber: BigNumber
  results: T[]
}

export async function multicall<T = utils.Result>(
  calls: Call[],
  overrides: CallOverrides = {}
): Promise<MulticallResult<T>> {
  const callRequests = calls.map((call) => {
    const iface = new utils.Interface([call.call])
    const callData = iface.encodeFunctionData(call.call, call.args)

    return {
      target: call.target,
      callData,
    }
  })

  const multicallContract = await ethers.getContractAt(multicallAbi, "0xeefba1e63905ef1d7acba5a8513c70307c1ce441")

  const response = await asNonNullable(multicallContract.callStatic.aggregate)(callRequests, overrides)
  const callCount = calls.length
  const callResult: T[] = []
  for (let i = 0; i < callCount; i++) {
    const call = calls[i]
    assertNonNullable(call)

    const iface = new utils.Interface([call.call])
    const returnData = response.returnData[i]
    const params = iface.decodeFunctionResult(call.call, returnData)
    if (params.length === 1) {
      callResult.push(params[0])
    } else {
      callResult.push(params as unknown as T)
    }
  }

  return {
    blockNumber: response.blockNumber,
    results: callResult,
  }
}
