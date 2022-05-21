import { createContext, ReactNode, useContext, useState } from "react";

import { getSignatureForKyc } from "@/lib/verify";

type Entity = "individual" | "entity";
type Residency = "us" | "non-us";
type Accredited = "accredited" | "non-accredited";
type Signature = Awaited<ReturnType<typeof getSignatureForKyc>>;

interface VerificationFlowContextInterface {
  entity?: Entity;
  setEntity: (e: Entity) => void;
  residency?: "us" | "non-us";
  setResidency: (r: Residency) => void;
  accredited?: "accredited" | "non-accredited";
  setAccredited: (a: Accredited) => void;
  signature?: Awaited<ReturnType<typeof getSignatureForKyc>>;
  setSignature: (s: Signature) => void;
}

const noop = () => undefined;
const Context = createContext<VerificationFlowContextInterface>({
  setEntity: noop, // prepopulating these context fields is necessary to satisy TypeScript, although at runtime these noops are not used
  setResidency: noop,
  setAccredited: noop,
  setSignature: noop,
});

export function useVerificationFlowContext() {
  return useContext(Context);
}

export function VerificationFlowContext({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState<Entity>();
  const [residency, setResidency] = useState<Residency>();
  const [accredited, setAccredited] = useState<Accredited>();
  const [signature, setSignature] = useState<Signature>();
  return (
    <Context.Provider
      value={{
        entity,
        setEntity,
        residency,
        setResidency,
        accredited,
        setAccredited,
        signature,
        setSignature,
      }}
    >
      {children}
    </Context.Provider>
  );
}
