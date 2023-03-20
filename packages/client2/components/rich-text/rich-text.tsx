import clsx from "clsx";
import { ReactNode } from "react";

import { Heading, Link } from "../design-system";

type RichTextNode = {
  type?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "ol" | "ul" | "li" | "link";
  children?: RichTextNode[];
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  newTab?: boolean;
  url?: string;
};

function renderRichText(documentNodes?: RichTextNode[]): ReactNode {
  if (!documentNodes) {
    return null;
  }
  return documentNodes.map((node, i) => {
    if (node.text) {
      return (
        <span
          key={i}
          className={clsx(
            node.bold && "font-bold",
            node.italic && "italic",
            node.underline && "underline"
          )}
        >
          {node.text}
        </span>
      );
    }
    if (!node) {
      return null;
    }
    switch (node.type) {
      case "h1":
        return (
          <Heading key={i} level={1} className="!text-lg">
            {renderRichText(node.children)}
          </Heading>
        );
      case "h2":
        return (
          <Heading key={i} level={2} className="!text-lg">
            {renderRichText(node.children)}
          </Heading>
        );
      case "h3":
        return (
          <Heading key={i} level={3} className="!text-lg">
            {renderRichText(node.children)}
          </Heading>
        );
      case "h4":
        return (
          <Heading key={i} level={4} className="!text-base">
            {renderRichText(node.children)}
          </Heading>
        );
      case "h5":
        return (
          <Heading key={i} level={5} className="!text-sm">
            {renderRichText(node.children)}
          </Heading>
        );
      case "ul":
        return (
          <ul key={i} className="list-disc space-y-5 pl-5">
            {renderRichText(node.children)}
          </ul>
        );
      case "ol":
        return (
          <ol key={i} className="list-decimal space-y-5 pl-5">
            {renderRichText(node.children)}
          </ol>
        );
      case "li":
        return <li key={i}>{renderRichText(node.children)}</li>;
      case "link":
        return (
          <Link
            key={i}
            href={node.url as string}
            target={node.newTab ? "_blank" : undefined}
            rel={node.newTab ? "noreferrer" : undefined}
          >
            {renderRichText(node.children) as string}
          </Link>
        );
      default:
        return <div key={i}>{renderRichText(node.children)}</div>;
    }
  });
}

interface RichTextProps {
  content: Parameters<typeof renderRichText>[0];
  className?: string;
}

export function RichText({ content, className }: RichTextProps) {
  return (
    <div className={clsx("space-y-8", className)}>
      {renderRichText(content)}
    </div>
  );
}
