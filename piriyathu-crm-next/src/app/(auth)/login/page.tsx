"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AppAlert, AppButton, AppInput } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const defaultEmail = process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL || "";
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function resolveRedirectPath(): string {
    if (typeof window === "undefined") return "/crm";
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("redirect");
    if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/crm";
    return candidate;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      router.push(resolveRedirectPath());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-white text-slate-900 lg:grid-cols-2">
      <section className="hidden bg-slate-950 p-12 text-slate-100 lg:flex lg:flex-col lg:justify-between">
        <div className="inline-flex w-fit rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.18em]">Piriyathu CRM</div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight">Drive growth with predictable workflows.</h1>
          <p className="mt-4 max-w-lg text-slate-300">
            A unified command center for leads, pipeline, finance, and operations. Built for high-velocity teams.
          </p>
        </div>
        <p className="text-xs text-slate-400">Enterprise Edition</p>
      </section>

      <section className="flex items-center justify-center bg-white p-6 text-slate-900 lg:p-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-600">Sign in to access your workspace.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <AppInput label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <AppInput label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error ? <AppAlert tone="error">{error}</AppAlert> : null}
            <AppButton
              loading={loading}
              type="submit"
              className="w-full border-primary bg-primary text-primary-content hover:border-primary hover:bg-primary"
            >
              {loading ? "Signing in..." : "Sign In"}
            </AppButton>
          </form>
        </div>
      </section>
    </main>
  );
}
