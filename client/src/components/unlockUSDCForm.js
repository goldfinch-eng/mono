import React, { useContext } from 'react';
import { AppContext } from '../App.js';
import { MAX_UINT } from '../ethereum/utils';
import LoadingButton from './loadingButton';
import { useForm, FormProvider } from 'react-hook-form';
import { iconInfo } from './icons.js';
import UnlockERC20Form from './unlockERC20Form';

function UnlockUSDCForm(props) {
  const { usdc, refreshUserData } = useContext(AppContext);
  const { unlockAddress } = props;

  return <UnlockERC20Form erc20={usdc} onUnlock={refreshUserData} unlockAddress={unlockAddress} />;
}

export default UnlockUSDCForm;
