import { useContext } from 'react';
import { AppContext } from '../App.js';

function useTXLoading(action, txData, setIsPending) {
  const { addPendingTX, markTXSuccessful, markTXErrored, refreshUserData } = useContext(AppContext);
  return (...args) => {
    const randomID = Math.floor(Math.random() * Math.floor(1000000000));
    const tx = { status: 'pending', id: randomID, ...txData };
    setIsPending(true);
    addPendingTX(tx);
    return action(...args)
      .then(result => {
        markTXSuccessful(tx);
        setIsPending(false);
        refreshUserData();
        return result;
      })
      .catch(error => {
        if (error.code === -32603) {
          error.message = 'Something went wrong with your transaction.';
        }
        markTXErrored(tx, error);
        setIsPending(false);
      });
  };
}

export default useTXLoading;
