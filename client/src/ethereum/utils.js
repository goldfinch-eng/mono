import { BN } from 'bn.js';

function sendFromUser(unsentTransaction, userAddress) {
  return unsentTransaction.send({
    from: userAddress,
    gasPrice: new BN('20000000000'),
    gas: new BN('6721975')
  });
}

export {
  sendFromUser,
}