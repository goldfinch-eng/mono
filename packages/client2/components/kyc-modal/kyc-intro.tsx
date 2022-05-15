import Image from "next/image";

import { Paragraph } from "@/components/design-system";

export function KYCModalIntro() {
  return (
    <>
      <h4 className="mb-5 text-center text-lg font-semibold">
        Goldfinch requires identity verification to participate
      </h4>

      <div className="mb-5 flex px-8">
        <div className="mx-2 flex-1 rounded-[10px] border border-sand-300 p-12">
          <h5 className="mb-5 text-center font-semibold">Step 1</h5>
          <div className="mb-5 flex justify-center">
            <div className="mx-1">
              <Image
                src="/content/persona-logo.png"
                alt="Persona"
                width={85}
                height={85}
              />
            </div>

            <div className="mx-1">
              <Image
                src="/content/parallel-logo.png"
                alt="Parallel Markets"
                width={85}
                height={85}
              />
            </div>
          </div>
          <Paragraph className="text-center">
            Complete KYC using Persona or Parallel Markets
          </Paragraph>
        </div>

        <div className="mx-2 flex-1 rounded-[10px] border border-sand-300 p-12">
          <h5 className="mb-5 text-center font-semibold">Step 2</h5>
          <div className="mb-5 flex justify-center">
            <Image
              src="/content/uid-logo.png"
              alt="Parallel Markets"
              width={85}
              height={85}
            />
          </div>
          <Paragraph className="text-center">
            Claim UID NFT for identity management
          </Paragraph>
        </div>
      </div>

      <Paragraph className="text-center text-xs">
        All information you provide is kept secure and will not be used for any
        purpose beyond executing your supply request. Why does Goldfinch KYC?
      </Paragraph>
    </>
  );
}
