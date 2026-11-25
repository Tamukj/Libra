"use client";

import React, { useEffect, useRef } from "react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  narrow?: boolean;
  dismissible?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible native modal <dialog> wrapper:
 * - Mounts only while open so hidden headings never pollute the accessibility tree.
 * - Restores focus to the triggering element on close.
 * - Guards backdrop clicks with pointerdown + pointerup outside checks so text-selection drags
 *   ending outside the dialog bounds do not accidentally dismiss the dialog.
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  narrow = false,
  dismissible = true,
  className = "",
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  return (
    <dialog
      ref={dialogRef}
      className={`libra-dialog ${narrow ? "dialog-narrow" : ""} ${className}`.trim()}
      aria-labelledby={labelledBy}
      {...({ closedby: dismissible ? "any" : "none" } as Record<string, string>)}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClose={() => {
        if (dismissible) onClose();
      }}
      onPointerDown={(e) => {
        const dialog = dialogRef.current;
        if (!dialog || !dismissible) return;
        pressedOutsideRef.current = isOutsideDialog(e, dialog);
      }}
      onPointerUp={(e) => {
        const dialog = dialogRef.current;
        if (!dialog || !dismissible) return;
        const releasedOutside = isOutsideDialog(e, dialog);
        if (pressedOutsideRef.current && releasedOutside) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
    >
      {children}
    </dialog>
  );
}
