import { gql } from "@apollo/client";

import { Link } from "@/components/design-system";
import { DocumentFieldsFragment } from "@/lib/graphql/generated";

import FileFolder from "./file-folder.svg";
import FilePDF from "./file-pdf.svg";

export const DOCUMENT_FIELDS = gql`
  fragment DocumentFields on Document {
    id
    title
    subtitle
    file {
      url
    }
  }
`;

interface DocumentsListProps {
  documents: DocumentFieldsFragment[];
}

const getFiletypeImage = (filename?: string | null) => {
  const type = filename?.split(".").pop()?.toLowerCase();

  return type === "pdf" ? FilePDF : FileFolder;
};

export function DocumentsList({ documents }: DocumentsListProps) {
  return (
    <div>
      <h2 className="mb-8 text-lg font-semibold">Documents</h2>
      <ul className="divide-y divide-sand-100 border-y border-sand-100">
        {documents.map((doc) => {
          const Thumbnail = getFiletypeImage(doc.file?.url);

          return (
            <li key={`document-list-${doc.id}`} className="py-6">
              <div className="relative flex items-center">
                <Thumbnail className="w-14 flex-shrink-0 sm:w-16" />
                <div className="ml-6 sm:ml-10">
                  <h5 className="mb-1 font-medium">
                    <Link
                      href={doc.file?.url as string}
                      target="_blank"
                      rel="noreferrer"
                      className="before:absolute before:inset-0"
                    >
                      {doc.title as string}
                    </Link>
                  </h5>
                  {doc.subtitle}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
