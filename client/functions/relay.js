const ForwarderAbi = require('../abi/Forwarder.json');
const BorrowerAbi = require('../abi/Borrower.json');
const ForwarderAddress = '0x956868751Cc565507B3B58E53a6f9f41B56bed74'; // GSN, not working
// const ForwarderAddress = '0xc0c223c94e16e51D79bF3b5e2FA43Fb7C61cd5D9'; // defender meta tx example, no source
const RelayerApiKey = 'CZmhcNr8DvNqN8FR5WThzJefBzmQPDDP';
const RelayerSecretKey = '5mSN1bndsYxwA1T767ZW43obQ9ZzFku6ZgeV6qPcU8KLJE2TW7aXEwpUJqAbZCqk';
const InfuraKEY = 'd8e13fc4893e4be5aae875d94fee67b7';

const { Relayer } = require('defender-relay-client');
const { ethers } = require('ethers');

const { TypedDataUtils } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-util');

const EIP712DomainType = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
]

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
    // TODO: Need to register this domain separator on the forwarder contract
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

async function relay(request) {
  // Unpack request
  const { to, from, value, gas, nonce, data, signature } = request;

  // Validate request
  const provider = new ethers.providers.InfuraProvider('rinkeby', InfuraKEY);
  const forwarder = new ethers.Contract(ForwarderAddress, ForwarderAbi, provider);
  const args = [
    { to, from, value, gas, nonce, data },
    DomainSeparator,
    TypeHash,
    SuffixData,
    signature
  ];
  console.log(`Verifying: ${JSON.stringify(args)}`);
  await forwarder.verify(...args);

  // Send meta-tx through Defender
  const forwardData = forwarder.interface.functions.execute.encode(args);
  const relayer = new Relayer({apiKey: RelayerApiKey, apiSecret: RelayerSecretKey});
  console.log(`Relaying: ${forwardData}`);
  // const tx = { hash: 'TEST' };
  const tx = await relayer.sendTransaction({
    speed: 'fast',
    to: ForwarderAddress,
    gasLimit: gas,
    data: forwardData,
  });

  console.log(`Sent meta-tx: ${tx.hash}, data: ${data}`);
  return tx;
}

// Handler for lambda function
exports.handler = async function(event, context, callback) {
  try {
    const data = JSON.parse(event.body);
    console.log(`Handling request: ${JSON.stringify(data)}`);
    const response = await relay(data);
    callback(null, { statusCode: 200, body: JSON.stringify(response) });
  } catch (err) {
    console.log(`Error: ${err}`);
    callback(err);
  }
};
