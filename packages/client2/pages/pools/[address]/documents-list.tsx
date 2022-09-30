import { gql } from "@apollo/client";

import { DocumentFieldsFragment } from "@/lib/graphql/generated";

import { FileItem } from "./subcomponents";

export const DOCUMENT_FIELDS = gql`
  fragment DocumentFields on Document {
    id
    title
    subtitle
    file {
      filename
      alt
      url
      mimeType
    }
  }
`;

interface DocumentsListProps {
  documents: DocumentFieldsFragment[];
}

export function DocumentsList({ documents }: DocumentsListProps) {
  return (
    <div>
      <h2 className="mb-8 text-lg font-semibold">Documents</h2>
      <ul className="divide-y divide-sand-100 border-y border-sand-100">
        {documents.map((doc) => {
          return (
            <li key={`document-list-${doc.id}`} className="py-6">
              <FileItem
                filename={doc.title as string}
                description={doc.subtitle}
                url={doc.file?.url as string}
                mimeType={doc.file?.mimeType as string}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
