import { Modal, ModalProps } from "@/components/design-system";

import { Flow } from "./flow";

interface VerificationModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  return (
    <Modal
      size="xs"
      title="Verify your identity"
      isOpen={isOpen}
      onClose={onClose}
      divider={true}
    >
      <div
        style={{ minHeight: "400px", display: "flex", flexDirection: "column" }}
      >
        <Flow />
      </div>
    </Modal>
  );
}
