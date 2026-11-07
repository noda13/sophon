import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

export function BackLink({ to, children }: { to: ComponentProps<typeof Link>['to']; children: string }) {
  return (
    <p className="mb-4">
      <Link to={to} className="text-sm text-accent hover:underline">
        ← {children}
      </Link>
    </p>
  );
}
