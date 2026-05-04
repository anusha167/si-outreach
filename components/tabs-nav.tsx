'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/queue', label: 'Approval Queue' },
  { href: '/contacts', label: 'All Contacts' },
  { href: '/events', label: 'Events' },
  { href: '/import', label: 'Import / Discover' },
  { href: '/team', label: 'Team' },
] as const;

export function TabsNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b" style={{ background: 'var(--bg)' }}>
      <div className="max-w-[1400px] mx-auto px-6 flex gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
