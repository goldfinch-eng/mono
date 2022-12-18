import { createContext, ReactNode, useContext, useState } from "react";

import { VerificationModalOverrides } from "./verification-modal/verification-modal";

interface VerificationModalContextInterface {
  modalOverrides?: VerificationModalOverrides;
  setModalOverrides?: (mo?: VerificationModalOverrides) => void;
}

const noop = () => undefined;
const Context = createContext<VerificationModalContextInterface>({
  setModalOverrides: noop, // prepopulating these context fields is necessary to satisy TypeScript, although at runtime these noops are not used
});

export function useVerificationModalContext() {
  return useContext(Context);
}

export function VerificationModalContext({
  children,
}: {
  children: ReactNode;
}) {
  const [modalOverrides, setModalOverrides] =
    useState<VerificationModalOverrides>();

  return (
    <Context.Provider
      value={{
        modalOverrides,
        setModalOverrides,
      }}
    >
      {children}
    </Context.Provider>
  );
}
