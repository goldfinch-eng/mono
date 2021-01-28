const ForwarderAbi = require('../../abi/Forwarder.json');
const BorrowerAbi = require('../../abi/Borrower.json');
const { TypedDataUtils } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-util');
// const { Relayer } = require('defender-relay-client');
const { ethers } = require('ethers');

const ForwarderAddress = '0x956868751Cc565507B3B58E53a6f9f41B56bed74';
const RelayerApiKey = 'CZmhcNr8DvNqN8FR5WThzJefBzmQPDDP';
const RelayerSecretKey = '5mSN1bndsYxwA1T767ZW43obQ9ZzFku6ZgeV6qPcU8KLJE2TW7aXEwpUJqAbZCqk';
const InfuraKEY = 'd8e13fc4893e4be5aae875d94fee67b7';

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
    '0xd3D57673BAE28880376cDF89aeFe4653A5C84A08',
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

  return relay({ ...request, signature });
}

async function relay(request) {
  // Unpack request
  const { to, from, value, gas, nonce, data, signature } = request;

  // Validate request
  const provider = new ethers.providers.InfuraProvider('rinkeby', InfuraKEY);
  const forwarder = new ethers.Contract(ForwarderAddress, ForwarderAbi, provider);
  const args = [{ to, from, value, gas, nonce, data }, DomainSeparator, TypeHash, SuffixData, signature];
  await forwarder.verify(...args);

  // Send meta-tx through Defender
  const forwardData = forwarder.interface.encodeFunctionData('execute', args);
  // const relayer = new Relayer(RelayerApiKey, RelayerSecretKey);
  // const tx = await relayer.sendTransaction({
  //   speed: 'fast',
  //   to: ForwarderAddress,
  //   gasLimit: gas,
  //   data: forwardData,
  // });

  // console.log(`Sent meta-tx: ${tx.hash}`);
  // return tx;
}

export { submitGaslessTransaction };
