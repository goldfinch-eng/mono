usePlugin("@nomiclabs/buidler-truffle5");

module.exports = {
  defaultNetwork: "buidlerevm",
  solc: {
    version: "0.6.8"
  },
  networks: {
    buidlerevm: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000
    }
  }
};
