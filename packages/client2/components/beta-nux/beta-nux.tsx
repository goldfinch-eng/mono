import { useEffect, useState } from "react";
import { useWizard, Wizard } from "react-use-wizard";

import { Button, GoldfinchLogo, Link, Modal } from "@/components/design-system";

const nuxPrefix = "betaNux";
const nuxVersion = 1; // Increment this if you wish for the nux to be shown again.
const nuxKey = `${nuxPrefix}-${nuxVersion}`;

export function BetaNux() {
  const [isNuxOpen, setIsNuxOpen] = useState(false);
  const closeNux = () => {
    setIsNuxOpen(false);
    localStorage.setItem(nuxKey, "viewed");
  };
  useEffect(() => {
    if (localStorage.getItem(nuxKey) !== "viewed") {
      setIsNuxOpen(true);
    }
  }, []);
  return (
    <Modal
      isOpen={isNuxOpen}
      onClose={closeNux}
      title={
        <div className="flex items-center gap-2 text-xs font-medium text-sand-500">
          <div className="rounded-full bg-sand-100 p-1">
            <GoldfinchLogo className="h-5 w-5" />
          </div>
          From the Goldfinch Team
        </div>
      }
      size="xs"
      divider
    >
      <Wizard footer={<Footer onFinish={closeNux} />}>
        <Step1 />
        <Step2 />
        <Step3 />
      </Wizard>
    </Modal>
  );
}

function Step1() {
  return (
    <div className="mt-2 flex flex-col gap-5 text-center">
      <div className="text-lg font-medium">
        🎉 Welcome to the Goldfinch 2.0 Beta
      </div>
      <div>We&apos;re making some big changes around here!</div>
      <div>
        ✨ You should notice site performance improvements and a new look + feel
        for the Earn, Senior Pool, and Borrower Pool pages.
      </div>
    </div>
  );
}

function Step2() {
  return (
    <div className="mt-2 flex flex-col gap-5 text-center">
      <div className="text-lg font-medium">👀 Just a Heads Up...</div>
      <div>
        🛠 We&apos;re testing some new things, so the overall look + feel may
        vary a lot across pages.
      </div>
      <div>
        Don&apos;t worry, it&apos;s all part of the same Dapp. Just excuse the
        “mess” while we&apos;re 🏗 under construction.
      </div>
    </div>
  );
}

function Step3() {
  return (
    <div className="mt-2 flex flex-col gap-5 text-center">
      <div className="text-lg font-medium">💬 Share Your Feedback</div>
      <div>
        Let us know what you think about the changes: use{" "}
        <Link
          target="_blank"
          rel="noopener"
          href="https://discord.gg/HVeaca3fN8"
        >
          Discord
        </Link>{" "}
        or email{" "}
        <Link href="mailto:beta@goldfinch.finance">beta@goldfinch.finance</Link>
        .
      </div>
      <div>
        ✨ Okay, now it&apos;s time to explore. Check out the revamped Borrower
        Pools, and see what it&apos;s like to supply some capital.
      </div>
    </div>
  );
}

function Footer({ onFinish }: { onFinish: () => void }) {
  const {
    previousStep,
    nextStep,
    activeStep,
    stepCount,
    isFirstStep,
    isLastStep,
  } = useWizard();
  return (
    <div className="mt-10 flex justify-between">
      <Button
        size="lg"
        colorScheme="secondary"
        onClick={isFirstStep ? onFinish : previousStep}
      >
        {isFirstStep ? "Skip" : "Back"}
      </Button>
      <span className="self-center text-xs text-sand-500">
        {activeStep + 1} of {stepCount}
      </span>
      <Button
        size="lg"
        colorScheme="primary"
        onClick={isLastStep ? onFinish : nextStep}
      >
        {isLastStep ? "Finish" : "Next"}
      </Button>
    </div>
  );
}
