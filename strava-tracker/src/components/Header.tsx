"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import Avatar from "./Avatar";
import Badge from "./Badge";

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="font-display text-lg font-extrabold uppercase tracking-tight text-text-primary">
            Strava Tracker
          </span>
          <nav className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
            <Link
              href="/"
              className={pathname === "/" ? "text-accent-positive" : "text-text-secondary hover:text-text-primary"}
            >
              Feed
            </Link>
            <Link
              href="/leaderboard"
              className={
                pathname === "/leaderboard"
                  ? "text-accent-positive"
                  : "text-text-secondary hover:text-text-primary"
              }
            >
              Leaderboard
            </Link>
          </nav>
        </div>

        {status === "authenticated" && session?.user ? (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar
                id={session.user.id}
                firstName={session.user.name?.split(" ")[0] ?? ""}
                lastName={session.user.name?.split(" ").slice(1).join(" ") ?? ""}
                photoUrl={session.user.image}
                size={28}
              />
              <span className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                {session.user.name}
              </span>
              {session.user.connectionStatus === "DISCONNECTED" && (
                <Badge variant="disconnected">Disconnected</Badge>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-full border border-border-strong px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-text-secondary transition hover:border-accent-alert hover:text-accent-alert"
            >
              Log out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("strava", { callbackUrl: "/" })}
            className="rounded-full bg-accent-positive px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-bg transition hover:opacity-90"
          >
            Login with Strava
          </button>
        )}
      </div>
    </header>
  );
}
