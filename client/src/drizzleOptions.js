import CreditDesk from '../../artifacts/CreditDesk.json';
import Pool from '../../artifacts/Pool.json';
import ProtocolConfig from '../config/protocol-local.json';

// Just here for testing purposes for now; Should remove later!
String.prototype.toCamelCase = function() {
  var str = this.valueOf();
  return str
      .replace(/\s(.)/g, function($1) { return $1.toUpperCase(); })
      .replace(/\s/g, '')
      .replace(/^(.)/, function($1) { return $1.toLowerCase(); });
};

// This is a hack because Drizzle expects these to be already deployed by Truffle, with a
// "networks" field. Our homegrown deployment doesn't do that right now,
// so I'm just inserting what drizzle expects for now to test things out.
// [CreditDesk, Pool].forEach((contract) => {
//   var contractName = contract.contractName.toCamelCase();
//   contract.networks = {
//     31337: ProtocolConfig[contractName].address,
//   }
// });

const options = {
  web3: {
    block: false,
    fallback: {
      type: "ws",
      url: "ws://127.0.0.1:9545",
    },
  },
  contracts: [CreditDesk, Pool],
  events: {
    // SimpleStorage: ["StorageSet"],
  },
  polls: {
    accounts: 1500,
  },
};

export default options;