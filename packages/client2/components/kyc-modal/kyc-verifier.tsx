import Image from "next/image";

interface KYCVerifierProps {
  verifier: "parallel" | "persona";
}

export function KYCVerifier({ verifier }: KYCVerifierProps) {
  return (
    <div className="mt-10 flex w-full flex-col items-center">
      {verifier === "persona" ? (
        <Image
          src="/content/persona-logo.png"
          width={120}
          height={120}
          alt={verifier}
        />
      ) : (
        <Image
          src="/content/parallel-logo.png"
          width={120}
          height={120}
          alt={verifier}
        />
      )}

      <p className="my-5 text-center">
        Goldfinch uses {verifier === "persona" ? "Persona" : "Parallel Markets"}{" "}
        to complete identity verification
      </p>

      <p className="text-center text-xs text-sand-500">
        All information is kept secure and will not be used for any purpose
        beyond executing your supply request. The only information we store is
        your ETH address, country, and approval status. We take privacy
        seriously. Why does Goldfinch KYC?
      </p>
    </div>
  );
}
