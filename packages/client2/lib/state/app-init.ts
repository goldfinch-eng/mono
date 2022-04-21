import { useEffect } from "react";

import { useGfiContract, useUsdcContract } from "../contracts";
import { useWallet } from "../wallet";
import { refreshGfiPrice, updateCurrentUserAttributes } from "./actions";

/**
 * Side effects that should run on the client as the app initializes
 */
export function useAppInitialization() {
  useEffect(() => {
    refreshGfiPrice();
  }, []);

  const { account } = useWallet();
  const { usdcContract } = useUsdcContract();
  useEffect(() => {
    if (account && usdcContract) {
      usdcContract.balanceOf(account).then((value) =>
        updateCurrentUserAttributes({
          account: account,
          usdcBalance: value,
        })
      );
    }
  }, [usdcContract, account]);

  const { gfiContract } = useGfiContract();
  useEffect(() => {
    if (account && gfiContract) {
      gfiContract
        .balanceOf(account)
        .then((value) =>
          updateCurrentUserAttributes({ account: account, gfiBalance: value })
        );
    }
  }, [gfiContract, account]);
}
