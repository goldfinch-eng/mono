import { ReactNode } from "react";

interface StepTemplateProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  footer: ReactNode;
}

export function StepTemplate({
  leftContent,
  rightContent,
  footer,
}: StepTemplateProps) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="my-8 flex flex-1 flex-col items-center justify-between md:flex-row">
        <div className="md:w-6/12">{leftContent}</div>
        <div className="mt-10 md:mt-0 md:w-5/12">{rightContent}</div>
      </div>
      <div className="mt-4 flex justify-between">{footer}</div>
    </div>
  );
}
