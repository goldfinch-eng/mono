usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-ethers");
usePlugin("buidler-deploy");

const INFURA_PROJECT_ID = "d8e13fc4893e4be5aae875d94fee67b7";
// Note this came from a new instance of Metamask that Blake set up
const TEST_USER_PRIVATE_KEY = "1774a8ac43395488c6856114659042665ee7267293744d7dc1411d31253e642b";

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
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${TEST_USER_PRIVATE_KEY}`]
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${TEST_USER_PRIVATE_KEY}`]
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      // accounts: [`0x${MAINNET_PRIVATE_KEY}`] This will prob need to come from an env var or something.
    }
  },
  namedAccounts: {
    admin: {
      default: 0,
      3: `0x83CB0ec2f0013a9641654b344D34615f95b7D7FC`,
      4: `0x83CB0ec2f0013a9641654b344D34615f95b7D7FC`,
    }
  }
};
