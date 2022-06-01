import { makeVar } from "@apollo/client";

export const isWalletModalOpenVar = makeVar<boolean>(false);

export const isVerificationModalOpenVar = makeVar<boolean>(false);

export const isMobileNavOpen = makeVar<boolean>(false);
