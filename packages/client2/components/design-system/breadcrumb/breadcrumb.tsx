import Image from "next/image";

import { Link } from "@/components/design-system/link";

interface BreadcrumbProps {
  image?: string;
  label: string;
  link?: string;
}

export function Breadcrumb({ image, label, link }: BreadcrumbProps) {
  const child = link ? (
    <Link href={link} className="!no-underline">
      {label}
    </Link>
  ) : (
    label
  );

  return (
    <div className="flex flex-row items-center justify-center text-sm font-medium">
      {image && (
        <div className="relative h-8 w-12 overflow-hidden rounded-full">
          <Image
            src={image}
            alt={label}
            className="mr-3 block h-full w-full object-contain object-center"
            layout="fill"
          />
        </div>
      )}
      {child}
    </div>
  );
}
