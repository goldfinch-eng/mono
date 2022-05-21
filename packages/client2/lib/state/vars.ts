import { makeVar } from "@apollo/client";

export const isWalletModalOpenVar = makeVar<boolean>(false);

export const isKYCModalOpenVar = makeVar<boolean>(false);

export const isUIDModalOpenVar = makeVar<boolean>(false);

export const isKYCDoneVar = makeVar<boolean>(false);

export const isVerificationModalOpenVar = makeVar<boolean>(false);
