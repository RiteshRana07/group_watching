"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    router.push(redirect);
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-bold mb-6">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 pr-11"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-sm"
            tabIndex={-1}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-accent rounded-lg py-2 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-400">
        No account yet?{" "}
        <Link href={`/signup?redirect=${encodeURIComponent(redirect)}`} className="text-accent">
          Create one
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
