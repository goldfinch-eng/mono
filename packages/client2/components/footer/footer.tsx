import clsx from "clsx";

import { Icon, Link } from "@/components/design-system";

const footerNavItems = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-screen-xl px-6 py-6 md:px-10">
        <div className="sm:flex sm:items-center sm:justify-between">
          <nav className="flex justify-center text-sm sm:justify-start">
            {footerNavItems.map((item, i) => (
              <Link
                key={`footer-link-${item.label}`}
                href={item.href}
                className={clsx("no-underline", i !== 0 ? "ml-4" : "")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 flex justify-center sm:mt-0 sm:justify-end">
            <a
              className="p-2 hover:opacity-75"
              href=""
              target="_blank"
              rel="noreferrer"
            >
              <span className="sr-only">Discord</span>

              <Icon name="Discord" size="md" />
            </a>

            <a
              className="p-2 hover:opacity-75"
              href=""
              target="_blank"
              rel="noreferrer"
            >
              <span className="sr-only">Twitter</span>

              <Icon name="Twitter" size="md" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
