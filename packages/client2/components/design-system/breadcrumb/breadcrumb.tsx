import Image from "next/future/image";

import { Link } from "@/components/design-system";

import { Shimmer } from "../spinners";

interface BreadcrumbProps {
  /**
   * Optional image to show beside the breadcrumb: URL, PNG string, or Static import
   */
  image?: string | null;

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
      {image ? (
        <Image
          src={image}
          alt={label || ""}
          className="mr-3 overflow-hidden rounded-full"
          width={32}
          height={32}
        />
      ) : (
        <div
          className="mr-3 rounded-full border border-sand-200 bg-sand-200"
          style={{ height: "32px", width: "32px" }}
        />
      )}
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
