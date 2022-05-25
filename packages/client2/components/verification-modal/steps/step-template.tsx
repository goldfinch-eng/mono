import clsx from "clsx";
import { ReactNode } from "react";
import { useWizard } from "react-use-wizard";

import { Button, InfoIconTooltip } from "@/components/design-system";

import { PrivacyStatement } from "./privacy-statement";

interface StepTemplateProps {
  heading?: string;
  headingTooltip?: string;
  headingClassName?: string;
  children: ReactNode;
  includePrivacyStatement?: boolean;
  footer?: ReactNode;
}

export function StepTemplate({
  heading,
  headingTooltip,
  headingClassName,
  children,
  includePrivacyStatement = true,
  footer,
}: StepTemplateProps) {
  const { previousStep } = useWizard();
  return (
    <div className="flex h-full grow flex-col">
      <div className="mt-6 flex grow flex-col">
        {heading ? (
          <div
            className={clsx(
              "mb-8 flex items-center gap-2",
              !headingTooltip ? "justify-center" : null
            )}
          >
            <h4
              className={clsx(
                "font-sans text-lg font-semibold",
                headingClassName
              )}
            >
              {heading}
            </h4>
            {headingTooltip ? (
              <InfoIconTooltip content={headingTooltip} placement="top-start" />
            ) : null}
          </div>
        ) : null}
        <div className="grow">{children}</div>
        {includePrivacyStatement ? <PrivacyStatement className="mt-8" /> : null}
      </div>
      <div className="mt-9 flex gap-3">
        {footer ? (
          footer
        ) : (
          <Button
            className="w-full"
            colorScheme="secondary"
            size="lg"
            onClick={previousStep}
          >
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
