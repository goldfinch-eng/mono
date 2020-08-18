import web3 from '../../web3';
import * as PoolContract from '../../../../artifacts/Pool.json';
const pool = new web3.eth.Contract(PoolContract.abi, "0x2AdAc39Ed0B1817acCB57349253AbAf7eE55560a");
export default pool;
