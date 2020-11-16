import React, { useContext } from 'react';
import { AppContext } from '../App.js';
import { sendFromUser, MAX_UINT } from '../ethereum/utils';
import LoadingButton from './loadingButton';
import { useForm, FormProvider } from 'react-hook-form';
import iconInfo from '../images/info-purp.svg';

function UnlockUSDCForm(props) {
  const { erc20, pool, user, refreshUserData } = useContext(AppContext);
  const formMethods = useForm();

  const unlockUSDC = async () => {
    return sendFromUser(erc20.methods.approve(pool._address, MAX_UINT), user.address).then(result => {
      refreshUserData();
    });
  };

  return (
    <FormProvider {...formMethods}>
      <div className="unlock-form background-container">
        <p>
          <img className="icon" src={iconInfo} alt="info" />
          Just this one time, you’ll first need to unlock your account to send USDC to Goldfinch.
        </p>
        <LoadingButton action={unlockUSDC} text={'Unlock USDC'} txData={{ type: 'Approval' }} />
      </div>
    </FormProvider>
  );
}

export default UnlockUSDCForm;
