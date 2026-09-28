import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface MetricInfoProps {
  title: string;
  explanation: string;
  formula?: string;
  className?: string;
}

export function MetricInfo({ title, explanation, formula, className = '' }: MetricInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        aria-label={`Learn more about ${title}`}
        aria-expanded={isOpen}
        className="p-1 text-[#6d7c9c] hover:text-[#e9eefb] rounded-full hover:bg-[#18213a] transition-colors focus:outline-none focus:ring-1 focus:ring-[#818cf8]"
      >
        <HelpCircle size={14} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          onMouseLeave={() => setIsOpen(false)}
          role="dialog"
          aria-label={title}
          className="absolute z-50 left-0 bottom-full mb-2 w-72 sm:w-80 p-3.5 bg-[#18213a] border border-[rgba(148,175,235,0.2)] rounded-xl shadow-2xl backdrop-blur-md text-xs text-[#e9eefb] animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-[rgba(148,175,235,0.12)]">
            <span className="font-semibold text-[#818cf8] text-sm">{title}</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#6d7c9c] hover:text-white p-0.5"
            >
              <X size={13} />
            </button>
          </div>
          <p className="mt-2 text-[#9aabcc] leading-relaxed">{explanation}</p>
          {formula && (
            <div className="mt-2 p-1.5 bg-[#111828] rounded border border-[rgba(148,175,235,0.08)] font-mono text-[11px] text-[#22d3ee]">
              {formula}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
