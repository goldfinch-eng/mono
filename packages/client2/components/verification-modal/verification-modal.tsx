import { Modal, ModalProps } from "@/components/design-system";

import {
  VerificationModalContext,
  useVerificationModalContext,
} from "../verification-modal-context";
import { Flow } from "./flow";

interface VerificationModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export interface VerificationModalOverrides {
  title?: string;
  unsetModalMinHeight?: boolean;
}

function VerificationModalWithoutContext({
  isOpen,
  onClose,
}: VerificationModalProps) {
  const { modalOverrides } = useVerificationModalContext();
  return (
    <Modal
      size="xs"
      title={modalOverrides?.title || "Verify your identity"}
      isOpen={isOpen}
      onClose={onClose}
      divider={true}
    >
      <div
        style={{
          minHeight: modalOverrides?.unsetModalMinHeight ? "unset" : "400px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Flow />
      </div>
    </Modal>
  );
}

export function VerificationModal(props: VerificationModalProps) {
  return (
    <VerificationModalContext>
      <VerificationModalWithoutContext {...props} />
    </VerificationModalContext>
  );
}
