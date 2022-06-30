import Image from "next/image";

import { Link } from "@/components/design-system";

import { Shimmer } from "../spinners";

interface BreadcrumbProps {
  /**
   * Optional image to show beside the breadcrumb: URL, PNG string, or Static import
   */
  image?: string;

  /**
   * The title of the breadcrumb
   */
  label?: string;

  /**
   * Optional link of the breadcrumb
   */
  link?: string;
}

export function Breadcrumb({ image, label, link }: BreadcrumbProps) {
  return (
    <div className="flex w-max flex-row items-center text-sm font-medium">
      <div className="relative mr-3 h-8 w-8 overflow-hidden rounded-full border border-sand-200 bg-sand-200">
        {image && (
          <Image
            src={image}
            alt={label || ""}
            className="mr-3 block h-full w-full object-contain object-center"
            layout="fill"
            sizes="32px"
            objectFit="cover"
          />
        )}
      </div>
      {link && label ? (
        <Link href={link} className="!no-underline">
          {label}
        </Link>
      ) : label ? (
        <span>{label}</span>
      ) : (
        <Shimmer style={{ width: "24ch" }} />
      )}
    </div>
  );
}
