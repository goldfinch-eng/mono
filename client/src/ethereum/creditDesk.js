import web3 from '../web3';
import * as CreditDeskContract from '../../../artifacts/CreditDesk.json';
import * as ProtocolConfig from '../../config/protocol-local.json';
const creditDesk = new web3.eth.Contract(CreditDeskContract.abi, ProtocolConfig.creditDesk.address);
export default creditDesk;