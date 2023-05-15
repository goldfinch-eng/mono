import { Icon, Link } from "@/components/design-system";

const footerNavItems = [
  { label: "About", href: "https://goldfinch.finance" },
  { label: "Newsletter", href: "https://goldfinch.substack.com/" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-screen-xl px-6 py-6 md:px-10">
        <div className="sm:flex sm:items-center sm:justify-between">
          <nav className="flex justify-center gap-4 text-sm font-medium sm:justify-start">
            {footerNavItems.map((item) => (
              <Link
                key={`footer-link-${item.label}`}
                href={item.href}
                className="no-underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 flex justify-center sm:mt-0 sm:justify-end">
            <a
              className="p-2 hover:opacity-75"
              href="https://discord.gg/goldfinch"
              target="_blank"
              rel="noreferrer"
            >
              <span className="sr-only">Discord</span>

              <Icon name="Discord" size="md" />
            </a>

            <a
              className="p-2 hover:opacity-75"
              href="https://twitter.com/goldfinch_fi"
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
