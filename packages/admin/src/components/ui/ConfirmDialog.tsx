"use client";

import { useState } from "react";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { getErrorMessage } from "../../lib/error";

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  /** For an irreversible action (e.g. "End Season"), require typing this exact text before Confirm enables — makes the step deliberate, not just an extra click to dismiss. */
  requireTypedConfirmation?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/** The shared irreversible-action confirmation step — used for delete actions everywhere, and for League System's End Season specifically because it's explicitly called out as needing one. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  requireTypedConfirmation,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = !requireTypedConfirmation || typedValue === requireTypedConfirmation;

  const handleConfirm = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => void handleConfirm()} disabled={!canConfirm || submitting}>
            {submitting ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      <p style={{ marginTop: 0, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{description}</p>
      {requireTypedConfirmation ? (
        <input
          value={typedValue}
          onChange={(event) => setTypedValue(event.target.value)}
          placeholder={`Type "${requireTypedConfirmation}" to confirm`}
          style={{
            width: "100%",
            height: 36,
            padding: "0 12px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 14,
          }}
        />
      ) : null}
    </Modal>
  );
}
