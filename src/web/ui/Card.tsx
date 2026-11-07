import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface CardProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
}

export function Card({ title, actions, className = '', children, ...rest }: CardProps) {
  return (
    <section className={`rounded-lg border border-border bg-surface-raised p-4 ${className}`} {...rest}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
