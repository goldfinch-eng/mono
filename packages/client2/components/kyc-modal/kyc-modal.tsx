import { useState, useEffect } from "react";

import { Modal, ModalProps, Button } from "@/components/design-system";
import { isKYCDoneVar } from "@/lib/state/vars";
import { openPersonaForm, getUIDLabel } from "@/lib/user";
import { useWallet } from "@/lib/wallet";

import { KYCConfirmation } from "./kyc-confirmation";
import { KYCModalIntro } from "./kyc-intro";
import { KYCStep } from "./kyc-step";
import { KYCModalUID } from "./kyc-uid";
import { KYCVerifier } from "./kyc-verifier";

export type TUIDAttributes =
  | "individual"
  | "entity"
  | "not-usa"
  | "usa"
  | "not-accredited"
  | "accredited";

type TSteps = {
  [key: string]: {
    heading: string;
    choices: {
      label: string;
      value: TUIDAttributes;
    }[];
  };
};

interface KYCModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function KYCModal({ isOpen, onClose }: KYCModalProps) {
  const { account } = useWallet();

  const initialStep = "intro";

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [history, setHistory] = useState<string[]>([initialStep]);
  const [uidAttributes, setUidAttributes] = useState<TUIDAttributes[]>([]);
  const [uidLabel, setUidLabel] = useState<string>();
  const [participation, setParticipation] = useState<
    "limited" | "full" | undefined
  >();
  const [isPersonaLoading, setPersonaLoading] = useState<boolean>(false);

  const steps: TSteps = {
    entity: {
      heading: "Who are you participating on behalf of?",
      choices: [
        {
          label: "An individual (myself)",
          value: "individual",
        },
        {
          label: "A business or entity",
          value: "entity",
        },
      ],
    },
    country: {
      heading: "Where do you pay taxes?",
      choices: [
        {
          label: "Outside the United States",
          value: "not-usa",
        },
        {
          label: "United States",
          value: "usa",
        },
      ],
    },
    accredited: {
      heading: "Are you a U.S. accredited investor?",
      choices: [
        {
          label: "Yes, I am U.S. accredited",
          value: "accredited",
        },
        {
          label: "No, I am not U.S. accredited",
          value: "not-accredited",
        },
      ],
    },
  };

  useEffect(() => {
    if (uidAttributes.length > 0) {
      const label = getUIDLabel(uidAttributes);

      setUidLabel(label);
    }
  }, [uidAttributes]);

  useEffect(() => {
    if (currentStep === "persona" || currentStep === "parallel") {
      if (uidAttributes.indexOf("usa") >= 0) {
        setParticipation("limited");
      } else {
        setParticipation("full");
      }
    } else {
      setParticipation(undefined);
    }
  }, [currentStep, uidAttributes]);

  return (
    <Modal
      size="md"
      title="Verify your identity"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="-mx-6 flex flex-col items-center border-y border-sand-200 py-7 px-6">
        {currentStep === "intro" && <KYCModalIntro />}

        {currentStep !== "intro" && (
          <div className="flex w-full">
            <div className="mr-10 flex-1">
              {currentStep === "entity" && (
                <KYCStep
                  {...steps.entity}
                  onSelection={(selection) => {
                    setUidAttributes([...uidAttributes, selection]);

                    setHistory([...history, "entity"]);
                    setCurrentStep("country");
                  }}
                />
              )}

              {currentStep === "country" && (
                <KYCStep
                  {...steps.country}
                  onSelection={(selection) => {
                    // create local to offset useState delay
                    const uid = [...uidAttributes, selection];

                    setUidAttributes(uid);

                    setHistory([...history, "country"]);

                    if (uid.indexOf("entity") >= 0) {
                      setCurrentStep("parallel");
                    } else if (uid.indexOf("usa") >= 0) {
                      setCurrentStep("accredited");
                    } else {
                      setCurrentStep("persona");
                    }
                  }}
                />
              )}

              {currentStep === "accredited" && (
                <KYCStep
                  {...steps.accredited}
                  onSelection={(selection) => {
                    // create local to offset useState delay
                    const uid = [...uidAttributes, selection];

                    setUidAttributes(uid);

                    setHistory([...history, "accredited"]);

                    if (uid.indexOf("accredited") >= 0) {
                      setCurrentStep("parallel");
                    } else {
                      setCurrentStep("persona");
                    }
                  }}
                />
              )}

              {currentStep === "persona" && <KYCVerifier verifier="persona" />}

              {currentStep === "parallel" && (
                <KYCVerifier verifier="parallel" />
              )}

              {currentStep === "confirmation" && <KYCConfirmation />}
            </div>

            <div className="w-5/12">
              <KYCModalUID text={uidLabel} participation={participation} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex w-full justify-between">
        {currentStep !== "intro" && currentStep !== "confirmation" && (
          <Button
            colorScheme="secondary"
            size="lg"
            onClick={() => {
              if (currentStep !== "intro") {
                // Remove last saved attribute
                setUidAttributes(uidAttributes.slice(0, -1));

                // Move to previous step in history
                setCurrentStep(history[history.length - 1]);

                // Remove last history step
                setHistory(history.slice(0, -1));
              }
            }}
          >
            Back
          </Button>
        )}

        {currentStep === "confirmation" && (
          <Button size="lg" onClick={onClose} className="mx-auto">
            Finish
          </Button>
        )}

        {currentStep === "intro" && (
          <Button
            size="lg"
            onClick={() => {
              setHistory(["intro"]);
              setCurrentStep("entity");
            }}
            className="mx-auto"
          >
            Begin
          </Button>
        )}

        {currentStep === "persona" && (
          <Button
            isLoading={isPersonaLoading}
            disabled={isPersonaLoading}
            size="lg"
            onClick={() => {
              if (account) {
                setPersonaLoading(true);
                openPersonaForm({
                  address: account,
                  onReady: () => {
                    setPersonaLoading(false);
                  },
                  onComplete: () => {
                    isKYCDoneVar(true);
                    setCurrentStep("confirmation");
                  },
                });
              }
            }}
            iconRight="ArrowSmRight"
          >
            Verify my identity
          </Button>
        )}
      </div>
    </Modal>
  );
}
