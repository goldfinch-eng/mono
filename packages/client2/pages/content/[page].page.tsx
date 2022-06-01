import { useRouter } from "next/router";
import ReactMarkdown from "react-markdown";

import { ContentBlock } from "@/components/design-system";

import data, { pages } from "./data";

export default function ContentPage() {
  const {
    query: { page },
  } = useRouter();

  let pageContent;

  if (page) {
    pageContent = data[page as typeof pages[number]];
  }

  return (
    <ContentBlock>
      <ReactMarkdown>{pageContent?.content || ""}</ReactMarkdown>
    </ContentBlock>
  );
}
