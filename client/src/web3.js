import Web3 from 'web3';
// This setup style would connect to metamask in browser if necessary.
// const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

// For local network testing.
const web3 = new Web3('http://127.0.0.1:8545');
export default web3;
