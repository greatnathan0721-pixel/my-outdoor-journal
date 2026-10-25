"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "./logo";
import { navLinks } from "./site-nav";

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[6000] border-b border-line/70 bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <Logo className="h-9 w-9 rounded-[10px] shadow-sm" />
          <span className="flex flex-col leading-tight">
            <span className="font-bold text-ink">我的旅遊遊記</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-wood">Travel Journal</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-forest text-on-accent" : "text-ink hover:bg-sand hover:text-forest"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="開啟選單"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-sand text-xl text-ink md:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="border-t border-line/70 bg-card px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium ${
                    pathname === l.href ? "bg-forest text-on-accent" : "text-ink hover:bg-sand"
                  }`}
                >
                  <span>{l.emoji}</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
