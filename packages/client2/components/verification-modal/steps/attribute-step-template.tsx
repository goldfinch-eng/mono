import { ReactNode } from "react";
import { useWizard } from "react-use-wizard";

import { Button } from "@/components/design-system";

import { UidPreview } from "../uid-preview";
import { StepTemplate } from "./step-template";

interface Props {
  heading: string;
  buttons: ReactNode;
}

export function AttributeStepTemplate({ heading, buttons }: Props) {
  const { previousStep } = useWizard();

  return (
    <StepTemplate
      leftContent={
        <>
          <h5 className="mb-8 text-lg font-semibold">{heading}</h5>

          <div className="flex flex-col gap-4">{buttons}</div>

          <p className="mt-7 text-xs text-sand-500">
            All information is kept secure and will not be used for any purpose
            beyond executing your supply request. The only information we store
            is your ETH address, country, and approval status. We take privacy
            seriously. Why does Goldfinch KYC?
          </p>
        </>
      }
      rightContent={<UidPreview />}
      footer={
        <Button onClick={previousStep} colorScheme="secondary" size="lg">
          Back
        </Button>
      }
    />
  );
  // return (
  //   <div>
  //     <div className="flex justify-between">
  //       <div className="flex w-6/12 flex-col">
  //         <h5 className="mb-8 text-lg font-semibold">{heading}</h5>

  //         <div className="flex flex-col gap-4">{buttons}</div>

  //         <p className="mt-7 text-xs text-sand-500">
  //           All information is kept secure and will not be used for any purpose
  //           beyond executing your supply request. The only information we store
  //           is your ETH address, country, and approval status. We take privacy
  //           seriously. Why does Goldfinch KYC?
  //         </p>
  //       </div>

  //       <div className="w-5/12">
  //         <UidPreview />
  //       </div>
  //     </div>
  //     <div>
  //       <Button onClick={previousStep} colorScheme="secondary" size="lg">
  //         Back
  //       </Button>
  //     </div>
  //   </div>
  // );
}
