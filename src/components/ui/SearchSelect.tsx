"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchSelectProps {
  label?: string;
  name?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function SearchSelect({
  label,
  name,
  options,
  value,
  onChange,
  placeholder = "Type to search...",
  error,
  disabled,
  required,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  // Position the dropdown relative to the input using fixed positioning
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Update position when open, and on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filtered.length - 1
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex].value);
      } else if (filtered.length === 1) {
        handleSelect(filtered[0].value);
      }
    }
  };

  const dropdown =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No matches found
              </div>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(option.value);
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`
                    w-full text-left px-3 py-2 text-sm transition-colors
                    ${
                      option.value === value
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : index === highlightIndex
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={`
          flex items-center border rounded-lg transition-colors
          ${disabled ? "bg-slate-100 cursor-not-allowed" : "bg-white"}
          ${
            isOpen
              ? "border-indigo-500 ring-2 ring-indigo-500"
              : error
                ? "border-red-500"
                : "border-slate-300 hover:border-slate-400"
          }
        `}
      >
        <input
          ref={inputRef}
          id={name}
          type="text"
          value={isOpen ? search : selectedOption?.label || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="flex-1 px-3 py-2 outline-none text-slate-900 placeholder-slate-400 bg-transparent rounded-lg disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {dropdown}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
