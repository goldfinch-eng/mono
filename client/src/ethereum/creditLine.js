import web3 from '../web3';
import * as CreditLineContract from '../../../artifacts/CreditLine.json';
function buildCreditLine(address) {
  return new web3.eth.Contract(CreditLineContract.abi, address);
}

function fetchCreditLineData(creditLine) {
  var result = {address: creditLine._address};
  const attributes = ["balance", "prepaymentBalance"];
  return Promise.all(attributes.map((methodName) => {
    return creditLine.methods[methodName].call();
  })).then((results) => {
    attributes.forEach((value, attribute) => {
      result[attribute] = value;
    });
    return result;
  });
}

export {
  buildCreditLine,
  fetchCreditLineData
}