import { gql } from "@apollo/client";

import { CDN_URL } from "@/constants";
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
      <ul className="m-0 list-none border-t border-sand-100 p-0">
        {documents.map((doc) => {
          const Thumbnail = getFiletypeImage(doc.file?.url);

          return (
            <li
              key={`document-list-${doc.id}`}
              className="flex w-full items-center border-b border-sand-100 py-6"
            >
              <div>
                <a
                  href={`${CDN_URL}${doc.file?.url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Thumbnail className="w-14 sm:w-[70px]" />
                </a>
              </div>
              <div className="ml-6 sm:ml-10">
                <h5 className="mb-1 font-medium">
                  <a
                    href={`${CDN_URL}${doc.file?.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {doc.title}
                  </a>
                </h5>
                {doc.subtitle}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
