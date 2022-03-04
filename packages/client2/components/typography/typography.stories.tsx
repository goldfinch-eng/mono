import { Story, Meta } from "@storybook/react";
import { ReactNode } from "react";

import { Heading, Paragraph, HelperText, LegalText } from "./index";

export default {
  title: "Components/Typography",
} as Meta;

interface GridRowProps {
  displayName: string;
  sample: ReactNode;
}

const GridRow = ({ displayName, sample }: GridRowProps) => {
  return (
    <>
      <div>{displayName}</div>
      <div>{sample}</div>
    </>
  );
};

export const TypographyStory: Story<{ text: string }> = ({ text }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        alignItems: "center",
        gap: "24px",
      }}
    >
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <GridRow
          key={level}
          displayName={`Heading ${level}`}
          sample={<Heading level={level}>{text}</Heading>}
        />
      ))}
      <GridRow displayName="Paragraph" sample={<Paragraph>{text}</Paragraph>} />
      <GridRow
        displayName="Helper Text"
        sample={<HelperText>{text}</HelperText>}
      />
      <GridRow
        displayName="Legal Text"
        sample={<LegalText>{text}</LegalText>}
      />
    </div>
  );
};

TypographyStory.args = {
  text: "The quick brown fox jumped over the lazy dog.",
};
