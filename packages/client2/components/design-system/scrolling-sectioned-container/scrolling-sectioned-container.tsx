import clsx from "clsx";
import { ReactNode, useEffect, useRef, useState } from "react";

import { Sentinel } from "@/components/design-system";

interface ScrollingSectionedContainerProps {
  sections: { title: string; navTitle: string; content: ReactNode }[];
  navAddons?: ReactNode;
}

const kebabCaseify = (s: string) => s.toLocaleLowerCase().replace(/\s/, "-");

export function ScrollingSectionedContainer({
  sections,
  navAddons,
}: ScrollingSectionedContainerProps) {
  const sectionNodes = useRef<HTMLDivElement[]>([]);
  const [isTopScrolled, setIsTopScrolled] = useState(true);
  const [scrolledNavIndex, setScrolledNavIndex] = useState(0);

  useEffect(() => {
    if (!sectionNodes.current) {
      return;
    }
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const sorted = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (sorted.length > 0) {
          const index = parseInt(
            sorted[0].target.getAttribute("data-index") as string
          );
          setScrolledNavIndex(index);
        }
      },
      { threshold: 0.8 }
    );
    for (const sectionNode of sectionNodes.current) {
      intersectionObserver.observe(sectionNode);
    }
    return () => intersectionObserver.disconnect();
  }, []);

  return (
    <div className="relative">
      <Sentinel onVisibilityChange={setIsTopScrolled} />
      <div
        className={clsx(
          "sticky top-0 flex max-w-max gap-1 rounded-full bg-mustard-50 transition-shadow",
          !isTopScrolled ? "shadow-md" : null
        )}
      >
        {sections.map(({ navTitle }, index) => (
          <ScrollNavLink
            key={navTitle}
            href={`#${kebabCaseify(navTitle)}`}
            isScrolled={scrolledNavIndex === index}
          >
            {navTitle}
          </ScrollNavLink>
        ))}
        {navAddons}
      </div>
      <div className="mt-8 space-y-15 px-4">
        {sections.map(({ navTitle, title, content }, index) => (
          <div
            key={navTitle}
            ref={(node) => {
              if (node && sectionNodes.current) {
                sectionNodes.current[index] = node;
              }
            }}
            data-index={index}
          >
            <h2 className="font-base mb-2 font-semibold">
              <a
                className="group scroll-mt-15 hover:underline"
                id={kebabCaseify(navTitle)}
                href={`#${kebabCaseify(navTitle)}`}
              >
                {title}
                <span className="hidden text-sand-400 group-hover:inline">
                  &nbsp;#
                </span>
              </a>
            </h2>
            {content}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScrollNavLink({
  children,
  href,
  isScrolled,
}: {
  children: ReactNode;
  href: string;
  isScrolled: boolean;
}) {
  return (
    <a
      className={clsx(
        "rounded-full px-4 py-2.5",
        isScrolled ? "bg-mustard-100 font-medium" : "font-normal"
      )}
      href={href}
    >
      {children}
    </a>
  );
}
