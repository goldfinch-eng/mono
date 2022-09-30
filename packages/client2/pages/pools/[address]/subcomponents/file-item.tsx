import { Button } from "@/components/design-system";

import PdfSvg from "./pdf.svg";
import ZipSvg from "./zip.svg";

interface FileItemProps {
  filename: string;
  description?: string | null;
  url: string;
  mimeType: string;
}

export function FileItem({
  filename,
  description,
  url,
  mimeType,
}: FileItemProps) {
  const Svg = mimeType === "application/pdf" ? PdfSvg : ZipSvg;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-10">
        <Svg className="h-20" />
        <div>
          <div className="mb-3 font-medium">{filename}</div>
          {description ? <div>{description}</div> : null}
        </div>
      </div>
      {mimeType === "application/zip" ? (
        <Button
          variant="rounded"
          colorScheme="secondary"
          as="a"
          download
          href={url as string}
          iconRight="ArrowDown"
        >
          Download
        </Button>
      ) : (
        <Button
          variant="rounded"
          colorScheme="secondary"
          as="a"
          href={url as string}
          iconRight="ArrowTopRight"
          target="_blank"
          rel="noreferrer noopener"
        >
          View
        </Button>
      )}
    </div>
  );
}
