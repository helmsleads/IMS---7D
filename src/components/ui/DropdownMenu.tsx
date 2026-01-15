"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  align?: "left" | "right";
  triggerIcon?: React.ReactNode;
  triggerClassName?: string;
}

export default function DropdownMenu({
  items,
  align = "right",
  triggerIcon,
  triggerClassName = "",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-colors ${triggerClassName}
        `}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {triggerIcon || <MoreVertical className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`
            absolute z-50 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5
            ${align === "right" ? "right-0" : "left-0"}
          `}
          role="menu"
        >
          <div className="py-1">
            {items.map((item, index) => (
              <div key={index}>
                {item.divider && index > 0 && (
                  <div className="my-1 border-t border-gray-100" />
                )}
                <button
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2 text-sm text-left
                    transition-colors
                    ${item.disabled
                      ? "text-gray-400 cursor-not-allowed"
                      : item.variant === "danger"
                      ? "text-red-600 hover:bg-red-50"
                      : "text-gray-700 hover:bg-gray-50"
                    }
                  `}
                  role="menuitem"
                >
                  {item.icon && (
                    <span className={item.disabled ? "opacity-50" : ""}>
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
