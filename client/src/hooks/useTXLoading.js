import { useContext } from 'react';
import { AppContext } from '../App.js';

function useTXLoading(action, setIsPending) {
  const { addPendingTX, markTXSuccessful } = useContext(AppContext);
  return (...args) => {
    const tx = {status: "pending", id: 5};
    setIsPending(true);
    addPendingTX(tx);
    return action(...args).then((result) => {
      markTXSuccessful(tx);
      setIsPending(false);
      return result;
    })
  }
}

export default useTXLoading;