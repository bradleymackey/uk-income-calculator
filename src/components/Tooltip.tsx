import { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPosition(spaceBelow < 80 ? 'top' : 'bottom');
    }
  }, [visible]);

  return (
    <span className="relative inline-flex" ref={triggerRef}>
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900 ${
            position === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          }`}
        >
          {content}
          <div
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              position === 'bottom'
                ? 'bottom-full border-b-neutral-900 dark:border-b-neutral-100'
                : 'top-full border-t-neutral-900 dark:border-t-neutral-100'
            }`}
          />
        </div>
      )}
    </span>
  );
}
