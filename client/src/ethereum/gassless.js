const ForwarderAbi = require('../../abi/Forwarder.json');
const BorrowerAbi = require('../../abi/Borrower.json');
const { TypedDataUtils } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-util');
const { ethers } = require('ethers');

const ForwarderAddress = '0x956868751Cc565507B3B58E53a6f9f41B56bed74'; // GSN not working
// const ForwarderAddress = '0xc0c223c94e16e51D79bF3b5e2FA43Fb7C61cd5D9'; // defender meta tx example, no source

const RelayUrl = '/relay';

const EIP712DomainType = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const ForwardRequestType = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'data', type: 'bytes' },
];

const TypedData = {
  domain: {
    name: 'Defender',
    version: '1',
    chainId: 4,
    verifyingContract: ForwarderAddress,
  },
  primaryType: 'ForwardRequest',
  types: {
    EIP712Domain: EIP712DomainType,
    ForwardRequest: ForwardRequestType,
  },
  message: {},
};

const GenericParams = 'address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data';
const TypeName = `ForwardRequest(${GenericParams})`;
const TypeHash = ethers.utils.id(TypeName);

const DomainSeparator = bufferToHex(TypedDataUtils.hashStruct('EIP712Domain', TypedData.domain, TypedData.types));
const SuffixData = '0x';

async function submitGaslessTransaction(contractAddress) {
  // Initialize provider and signer from metamask
  // await window.ethereum.enable();
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  const from = await signer.getAddress();
  const network = await provider.getNetwork();
  // if (network.chainId !== 4) throw new Error('Must be connected to Rinkeby');

  // Get nonce for current signer
  const forwarder = new ethers.Contract(ForwarderAddress, ForwarderAbi, provider);
  const nonce = await forwarder.getNonce(from).then(nonce => nonce.toString());

  // Encode meta-tx request
  const borrowerInterface = new ethers.utils.Interface(BorrowerAbi);
  const data = borrowerInterface.functions.drawdown.encode([
    '0xfa9331845f84b0ed88F5353B8cd3F7310F0B3fD9',
    1000000,
    '0xE7f9ED35DA54b2e4A1857487dBf42A32C4DBD4a0',
  ]);
  const request = {
    from,
    to: contractAddress,
    value: 0,
    gas: 1e6,
    nonce,
    data,
  };
  const toSign = { ...TypedData, message: request };

  // Directly call the JSON RPC interface, since ethers does not support signTypedDataV4 yet
  // See https://github.com/ethers-io/ethers.js/issues/830
  const signature = await provider.send('eth_signTypedData_v4', [from, JSON.stringify(toSign)]);

  const response = await fetch(RelayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, signature })
  }).then(r => r.json());

  return response;
}


export { submitGaslessTransaction };
