import {IERC20Permit} from "@goldfinch-eng/protocol/typechain/web3/IERC20Permit"
import {BigNumber} from "bignumber.js"
import {ethers} from "ethers"
import ERC20PermitABI from "../../abi/ERC20Permit.json"
import {AppContext} from "../App"
import {ERC20} from "../ethereum/erc20"
import web3 from "../web3"
import useNonNullContext from "./useNonNullContext"
const splitSignature = ethers.utils.splitSignature

interface SignatureData {
  v: number
  r: string
  s: string
  deadline: string
  nonce: string
  owner: string
  spender: string
  chainId: string
  tokenAddress: string
  value: string
}

const EIP712_DOMAIN_TYPE = [
  {name: "name", type: "string"},
  {name: "version", type: "string"},
  {name: "chainId", type: "uint256"},
  {name: "verifyingContract", type: "address"},
]

const EIP2612_TYPE = [
  {name: "owner", type: "address"},
  {name: "spender", type: "address"},
  {name: "value", type: "uint256"},
  {name: "nonce", type: "uint256"},
  {name: "deadline", type: "uint256"},
]

export default function useERC20Permit(): {
  gatherPermitSignature: ({
    token,
    value,
    spender,
  }: {
    token: ERC20
    value: BigNumber
    spender: string
  }) => Promise<SignatureData>
} {
  const {goldfinchProtocol, user, currentBlock} = useNonNullContext(AppContext)
  const owner = user.address

  async function gatherPermitSignature({token, value, spender}: {token: ERC20; value: BigNumber; spender: string}) {
    const tokenAddress = token.address
    const contract = goldfinchProtocol.getContract<IERC20Permit>(ERC20PermitABI, tokenAddress)

    // Default to one hour
    const deadlineFromNow = new BigNumber(process.env.REACT_APP_PERMIT_DEADLINE || 60 * 60)
    const now = currentBlock.timestamp
    const deadline = new BigNumber(now).plus(deadlineFromNow)

    const nonce = await contract.userWallet.methods.nonces(owner).call(undefined, "latest")
    const chainId = await web3.userWallet.eth.getChainId()
    const message = {
      owner,
      spender,
      value,
      nonce,
      deadline: deadline.toString(),
    }
    const domain = {
      name: token.name,
      version: token.permitVersion,
      verifyingContract: tokenAddress,
      chainId: chainId,
    }

    const data = JSON.stringify({
      types: {
        EIP712Domain: EIP712_DOMAIN_TYPE,
        Permit: EIP2612_TYPE,
      },
      domain,
      primaryType: "Permit",
      message,
    })

    const provider = new ethers.providers.Web3Provider(web3.userWallet.currentProvider as any)
    const signature = await provider.send("eth_signTypedData_v4", [owner, data]).then(splitSignature)
    return {
      v: signature.v!,
      r: signature.r,
      s: signature.s,
      deadline: deadline.toString(),
      nonce: nonce!,
      owner,
      spender,
      chainId: chainId.toString(),
      tokenAddress,
      value: value.toString(),
    }
  }

  return {
    gatherPermitSignature,
  }
}
