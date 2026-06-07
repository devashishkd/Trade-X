import React, { type ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  title?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, contentClassName, title, footer, noPadding = false }) => {
  return (
    <div className={clsx('glass-panel flex flex-col', className)}>
      {title && (
        <div className="card-header border-b border-white/10 px-6 py-4 font-semibold">
          {title}
        </div>
      )}
      <div className={clsx('flex-1', !noPadding && 'p-6', contentClassName)}>
        {children}
      </div>
      {footer && (
        <div className="card-footer border-t border-white/10 px-6 py-4 bg-black/20">
          {footer}
        </div>
      )}
    </div>
  );
};
