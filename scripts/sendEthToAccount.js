// My local metamask account
// 0x83CB0ec2f0013a9641654b344D34615f95b7D7FC

const Web3 = require('web3');
const BN = require('bn.js');
const fs = require('fs');
const web3 = new Web3('http://127.0.0.1:8545');

async function sendFunds() {
  const toAddress = process.env.TO_ADDRESS || "0x83CB0ec2f0013a9641654b344D34615f95b7D7FC";
  console.log("Starting to send funds...");
  [borrower, owner, capitalProvider] = await web3.eth.getAccounts();
  web3.eth.sendTransaction({from: capitalProvider, to: toAddress, value: new BN(String(50e18))});
  console.log("Sent funds!");
}

sendFunds();
