"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/library", label: "My Library" },
  { href: "/rooms", label: "Watch Rooms" },
];

export default function Nav({ username }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="border-b border-neutral-900">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="font-semibold text-lg">
            WatchTogether
          </Link>
          <div className="flex gap-6 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  pathname === l.href
                    ? "text-white font-medium"
                    : "text-neutral-500 hover:text-neutral-200"
                }
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {username && <span className="text-sm text-neutral-400">{username}</span>}
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
            }}
            className="text-sm text-neutral-500 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
