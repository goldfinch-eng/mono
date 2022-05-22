import Image from "next/image";
import { useWizard } from "react-use-wizard";

import { Button, Paragraph } from "@/components/design-system";

import parallelLogo from "./parallel-logo.png";
import personaLogo from "./persona-logo.png";
import uidLogo from "./uid-logo.png";

export function IntroStep() {
  const { nextStep } = useWizard();
  return (
    <div>
      <h4 className="mb-5 text-center text-lg font-semibold">
        Goldfinch requires identity verification to participate
      </h4>

      <div className="mb-5 flex justify-center gap-5">
        <div className="w-5/12 rounded-[10px] border border-sand-300 p-10">
          <h5 className="mb-5 text-center font-semibold">Step 1</h5>
          <div className="mb-5 flex justify-center gap-2">
            <Image
              src={personaLogo}
              alt="Persona"
              width={85}
              height={85}
              quality={100}
            />

            <Image
              src={parallelLogo}
              alt="Parallel Markets"
              width={85}
              height={85}
              quality={100}
            />
          </div>
          <Paragraph className="text-center">
            Complete KYC using Persona or Parallel Markets
          </Paragraph>
        </div>

        <div className="w-5/12 rounded-[10px] border border-sand-300 p-10">
          <h5 className="mb-5 text-center font-semibold">Step 2</h5>
          <div className="mb-5 flex justify-center">
            <Image
              src={uidLogo}
              alt="UID"
              width={85}
              height={85}
              quality={100}
            />
          </div>
          <Paragraph className="text-center">
            Claim UID NFT for identity management
          </Paragraph>
        </div>
      </div>

      <Paragraph className="m-auto mb-10 text-center text-xs text-sand-400">
        All information you provide is kept secure and will not be used for any
        purpose beyond executing your supply request. Why does Goldfinch KYC?
      </Paragraph>

      <div className="flex justify-center">
        <Button size="lg" onClick={nextStep}>
          Begin
        </Button>
      </div>
    </div>
  );
}
