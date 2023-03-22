import clsx from "clsx";
import Image, { StaticImageData } from "next/future/image";
import { ReactNode, useState } from "react";

import { Icon } from "@/components/design-system";

interface ExpandableCardProps {
  className?: string;
  icon: StaticImageData;
  heading: string;
  subheading: string;
  headingLabel: string;
  slot1: ReactNode;
  slot1Label: string;
  slot2: ReactNode;
  slot2Label: ReactNode;
  slot3?: ReactNode;
  slot3Label?: ReactNode;
  hideTopLabels?: boolean;
  children: ReactNode;
}

export function ExpandableCard({
  className,
  icon,
  heading,
  subheading,
  headingLabel,
  slot1,
  slot1Label,
  slot2,
  slot2Label,
  slot3,
  slot3Label,
  hideTopLabels = false,
  children,
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSlot3 = !!(slot3 && slot3Label);

  const slot1PlacementClass = clsx(
    "col-end-12 col-span-4 hidden xs:block md:col-span-2",
    hasSlot3 ? "md:col-end-8" : "md:col-end-10"
  );
  return (
    <div className={className}>
      {!hideTopLabels ? (
        <div className="mx-6 mb-3 hidden grid-cols-12 text-sand-500 xs:grid">
          <div className="col-span-5">{headingLabel}</div>
          <div className={`justify-self-end ${slot1PlacementClass}`}>
            {slot1Label}
          </div>
          <div className="col-span-2 hidden justify-self-end md:block">
            {slot2Label}
          </div>
          {hasSlot3 ? (
            <div className="col-span-2 hidden justify-self-end md:block">
              {slot3Label}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="relative rounded-xl bg-sand-100 py-4 px-6 hover:bg-sand-200">
        <div className="grid grid-cols-12 items-center">
          <div className="col-span-11 xs:col-span-7 md:col-span-5">
            <div className="flex items-center">
              <Image src={icon} height={48} width="auto" alt="" />
              <div className="ml-4">
                <div className="mb-1.5 text-xl font-medium">{heading}</div>
                <div className="text-sand-700">{subheading}</div>
              </div>
            </div>
          </div>
          <div
            className={`justify-self-end text-xl text-sand-700 ${slot1PlacementClass}`}
          >
            {slot1}
          </div>
          <div className="col-span-2 hidden justify-self-end text-xl text-sand-700 md:block">
            {slot2}
          </div>
          {hasSlot3 ? (
            <div className="col-span-2 hidden justify-self-end text-xl text-sand-700 md:block">
              {slot3}
            </div>
          ) : null}
          <div className="col-end-13 row-start-1 flex items-center justify-self-end">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="before:absolute before:inset-0"
            >
              <Icon
                name="ChevronDown"
                size="lg"
                className={clsx(
                  "transition-transform",
                  isExpanded ? "rotate-180" : null
                )}
              />
            </button>
          </div>
        </div>
        {isExpanded ? (
          <div className="relative z-10">
            {/* The relative z-10 classes are here to make sure this content stacks on top of the card, and doesn't cause the card to collapse when clicked */}
            <hr className="my-6 border-t border-sand-300" />
            <div className="gap mb-6 flex flex-col gap-x-12 gap-y-3 xs:flex-row md:hidden">
              <TuckedSlot
                label={slot1Label}
                value={slot1}
                className="block xs:hidden"
              />
              <TuckedSlot
                label={slot2Label}
                value={slot2}
                className="block md:hidden"
              />
              {hasSlot3 ? (
                <TuckedSlot
                  label={slot3Label}
                  value={slot3}
                  className="block md:hidden"
                />
              ) : null}
            </div>
            <div>{children}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TuckedSlot({
  className,
  label,
  value,
}: {
  className?: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-sand-500">{label}</div>
      <div className="text-xl text-sand-700">{value}</div>
    </div>
  );
}
