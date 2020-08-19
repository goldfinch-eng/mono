import web3 from '../web3';
import * as CreditLineContract from '../../../artifacts/CreditLine.json';
function getCreditLine(address) {
  return new web3.eth.Contract(CreditLineContract.abi, address);
}
export default getCreditLine;