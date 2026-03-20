"use client";

import { ReactNode, useEffect, useState, useCallback, useRef, useId } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

const FOCUSABLE_SELECTORS =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();

  const handleClose = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setVisible(false);
      onClose();
    }, 150);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setAnimating(false);
    } else if (visible) {
      setAnimating(true);
      setTimeout(() => {
        setAnimating(false);
        setVisible(false);
      }, 150);
    }
  }, [isOpen]);

  // Save trigger and restore focus on close
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    } else {
      if (triggerRef.current && (triggerRef.current as HTMLElement).focus) {
        (triggerRef.current as HTMLElement).focus();
        triggerRef.current = null;
      }
    }
  }, [isOpen]);

  // Focus first focusable element when modal opens
  useEffect(() => {
    if (visible && isOpen && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }
  }, [visible, isOpen]);

  // Escape key handler and body scroll lock
  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [visible]);

  // Focus trap: Tab/Shift+Tab cycle within modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        ).filter((el) => !el.closest('[aria-hidden="true"]'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [handleClose]
  );

  if (!visible && !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-8">
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm ${animating ? "animate-modal-fade-out" : "animate-modal-fade-in"}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onKeyDown={handleKeyDown}
        className={`
          relative bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.05)] w-full mx-4 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col
          ${sizeStyles[size]}
          ${animating ? "animate-modal-scale-down" : "animate-modal-scale-up"}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title || "\u00A0"}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="border-t border-slate-100 px-4 py-3 flex justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
