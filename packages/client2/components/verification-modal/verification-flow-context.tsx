import { createContext, ReactNode, useContext, useState } from "react";

import { getSignatureForKyc } from "@/lib/verify";

type Entity = "individual" | "entity";
type Residency = "us" | "non-us";
type IdIssuer = "us" | "non-us";
type Accredited = "accredited" | "non-accredited";
type Signature = Awaited<ReturnType<typeof getSignatureForKyc>>;

interface VerificationFlowContextInterface {
  entity?: Entity;
  setEntity: (e: Entity) => void;
  residency?: Residency;
  setResidency: (r: Residency) => void;
  idIssuer?: IdIssuer;
  setIdIssuer: (i: IdIssuer) => void;
  accredited?: Accredited;
  setAccredited: (a: Accredited) => void;
  signature?: Awaited<ReturnType<typeof getSignatureForKyc>>;
  setSignature: (s: Signature) => void;
  uidVersion?: number;
  setUidVersion: (v: number) => void;
}

const noop = () => undefined;
const Context = createContext<VerificationFlowContextInterface>({
  setEntity: noop, // prepopulating these context fields is necessary to satisy TypeScript, although at runtime these noops are not used
  setResidency: noop,
  setIdIssuer: noop,
  setAccredited: noop,
  setSignature: noop,
  setUidVersion: noop,
});

export function useVerificationFlowContext() {
  return useContext(Context);
}

export function VerificationFlowContext({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState<Entity>();
  const [residency, setResidency] = useState<Residency>();
  const [idIssuer, setIdIssuer] = useState<IdIssuer>();
  const [accredited, setAccredited] = useState<Accredited>();
  const [signature, setSignature] = useState<Signature>();
  const [uidVersion, setUidVersion] = useState<number>();

  return (
    <Context.Provider
      value={{
        entity,
        setEntity,
        residency,
        setResidency,
        idIssuer,
        setIdIssuer,
        accredited,
        setAccredited,
        signature,
        setSignature,
        uidVersion,
        setUidVersion,
      }}
    >
      {children}
    </Context.Provider>
  );
}
