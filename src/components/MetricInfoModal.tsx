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
        className="p-1 text-muted hover:text-text rounded-full hover:bg-raised transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <HelpCircle size={14} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          onMouseLeave={() => setIsOpen(false)}
          role="dialog"
          aria-label={title}
          className="absolute z-50 left-0 bottom-full mb-2 w-72 sm:w-80 p-3.5 bg-raised border border-line/20 rounded-xl shadow-2xl backdrop-blur-md text-xs text-text animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-line/12">
            <span className="font-semibold text-primary text-sm">{title}</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-text-strong p-0.5"
            >
              <X size={13} />
            </button>
          </div>
          <p className="mt-2 text-text-secondary leading-relaxed">{explanation}</p>
          {formula && (
            <div className="mt-2 p-1.5 bg-surface rounded border border-line/8 font-mono text-[11px] text-info">
              {formula}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
