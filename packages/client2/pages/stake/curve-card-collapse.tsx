import clsx from "clsx";
import Image from "next/image";
import { useState, ReactNode } from "react";

import { Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { CryptoAmount } from "@/lib/graphql/generated";

import stakeFiduImg from "../../public/ui/stake-fidu.png";
import stakeUsdcImg from "../../public/ui/stake-usdc.png";

interface StakeCardCollapseProps {
  children: ReactNode;
  heading: string;
  subheading: string;
  apy?: number | null;
  available?: CryptoAmount | null;
  image: "USDC" | "FIDU";
}

const IMG_HEIGHT = 48;

export default function CurveCardCollapse({
  children,
  heading,
  subheading,
  apy,
  available,
  image,
}: StakeCardCollapseProps) {
  const [isOpen, setIsOpen] = useState(false);

  const img = image === "USDC" ? stakeUsdcImg : stakeFiduImg;

  const IMG_RATIO = img.height / IMG_HEIGHT;

  return (
    <div className="relative rounded-xl bg-sand-100 py-4 px-6 hover:bg-sand-200">
      <div className="grid grid-cols-11 items-center">
        <div className="col-span-6">
          <div className="flex items-center">
            <Image
              src={img}
              alt={heading}
              height={IMG_HEIGHT}
              width={img.width / IMG_RATIO}
            />

            <div className="ml-4 flex-1">
              <div className="mb-1 text-xl font-medium">{heading}</div>
              <div className="text-sand-700">{subheading}</div>
            </div>
          </div>
        </div>
        <div className="col-span-2 text-xl">{apy}</div>
        <div className="col-span-2 text-xl">
          {available ? formatCrypto(available, { includeSymbol: false }) : null}
        </div>
        <div className="col-span-1 text-right">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="ml-6 before:absolute before:inset-0"
          >
            <Icon
              name="ChevronDown"
              size="lg"
              className={clsx(
                "transition-transform",
                isOpen ? "rotate-180" : null
              )}
            />
          </button>
        </div>
      </div>
      {isOpen ? (
        <>
          <div className="relative z-10 -mx-6 mt-4 border-t border-sand-300 px-6 pt-6">
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}
