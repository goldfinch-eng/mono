import { useEffect } from "react";
import { useWizard } from "react-use-wizard";

import { useVerificationModalContext } from "../verification-modal-context";
import { VerificationFlowSteps } from "./step-manifest";
import { VerificationModalOverrides } from "./verification-modal";

const modalOverrides: {
  [key in VerificationFlowSteps]?: VerificationModalOverrides;
} = {
  [VerificationFlowSteps.Mint]: {
    title: "Mint your UID",
  },
  [VerificationFlowSteps.MintToAddressEntry]: {
    title: "Enter smart contract wallet address",
    unsetModalMinHeight: true,
  },
};

type WizardStepsContainerProps = {
  wizardStep: JSX.Element;
};
export const WizardStepsContainer = ({
  wizardStep,
}: WizardStepsContainerProps) => {
  const { activeStep } = useWizard();
  const { setModalOverrides } = useVerificationModalContext();
  useEffect(() => {
    setModalOverrides &&
      setModalOverrides(modalOverrides[activeStep as VerificationFlowSteps]);
  }, [activeStep, setModalOverrides]);

  return wizardStep;
};
