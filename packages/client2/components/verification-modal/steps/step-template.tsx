import clsx from "clsx";
import { ReactNode } from "react";
import { useWizard } from "react-use-wizard";

import { Button, InfoIconTooltip } from "@/components/design-system";

import { PrivacyStatement } from "./privacy-statement";

interface StepTemplateProps {
  heading?: string;
  headingTooltip?: string;
  headingClassName?: string;
  subheading?: string;
  children: ReactNode;
  includePrivacyStatement?: boolean;
  footer?: ReactNode;
}

export function StepTemplate({
  heading,
  headingTooltip,
  headingClassName,
  subheading,
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
              "flex items-center gap-2",
              !headingTooltip ? "justify-center" : null,
              subheading ? "mb-3" : "mb-8"
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

        {subheading ? (
          <p className="mb-8 text-justify text-xs text-sand-500">
            {subheading}
          </p>
        ) : null}

        <div className="grow">{children}</div>

        {includePrivacyStatement ? <PrivacyStatement className="mt-8" /> : null}
      </div>
      <div className="-mx-6 mt-9 flex gap-3 border-t border-t-sand-100 px-6 pt-6">
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
