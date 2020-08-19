import web3 from '../web3';
import * as PoolContract from '../../../build/Pool.json';
import * as ProtocolConfig from '../../config/protocol-local.json';
const pool = new web3.eth.Contract(PoolContract.abi, ProtocolConfig.pool.address);
export default pool;
