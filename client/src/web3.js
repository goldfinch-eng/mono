import Web3 from 'web3';
// This setup style would connect to metamask in browser if necessary.
// const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
let web3;
if (typeof window.ethereum !== 'undefined') {
  web3 = new Web3(window.ethereum);
} else {
  // For local network testing.
  web3 = new Web3('http://127.0.0.1:8545');
}

export default web3;

