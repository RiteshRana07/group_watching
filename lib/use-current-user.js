"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Fetches the current user, redirecting to /login if signed out.
// Returns `undefined` while loading, then the user object once known.
export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) return router.push("/login");
        setUser(d.user);
      });
  }, [router]);

  return user;
}
