'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UserPlus, UserCircle, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/broker/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/broker/submit-lead',  label: 'Submit Lead', icon: UserPlus },
  { href: '/broker/profile',      label: 'Profile',     icon: UserCircle },
];

export default function BrokerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Top Navigation */}
      <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
        {/* Left: Brand */}
        <Link href="/broker/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">Z</span>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">
            <span className="text-violet-400">Z</span>or<span className="text-violet-400">S</span>pace
          </span>
        </Link>

        {/* Center: Nav Links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-violet-600/15 text-violet-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-violet-400' : ''}`} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Broker Name + Logout */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 hidden md:inline">Mike Thompson</span>
          <Link
            href="/broker/login"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
