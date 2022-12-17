import { useState } from "react";

import { Modal, ModalProps } from "@/components/design-system";

import { Flow } from "./flow";

interface VerificationModalProps {
  isOpen: ModalProps["isOpen"];
  onClose: ModalProps["onClose"];
}

export function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
  const [title, setTitle] = useState<string>("Verify your identity");
  return (
    <Modal
      size="xs"
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      divider={true}
    >
      <div
        style={{ minHeight: "400px", display: "flex", flexDirection: "column" }}
        data-id="verification.modal"
      >
        <Flow setTitle={setTitle} />
      </div>
    </Modal>
  );
}
