"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";

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
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (visible) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [visible, handleClose]);

  if (!visible && !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-8">
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm ${animating ? "animate-modal-fade-out" : "animate-modal-fade-in"}`}
        onClick={handleClose}
      />
      <div
        className={`
          relative bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.05)] w-full mx-4 my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col
          ${sizeStyles[size]}
          ${animating ? "animate-modal-scale-down" : "animate-modal-scale-up"}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {title || "\u00A0"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
