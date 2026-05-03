"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Factory } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleTryDemo() {
    setError("");
    setDemoLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "demo@factoryos.com",
      password: "FactoryOS2026",
    });

    if (authError) {
      setError("Demo account not available yet. Contact support.");
      setDemoLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <Factory size={16} className="text-blue-400" />
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">Line Pulse</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your credentials to access the dashboard.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourfactory.com"
              required
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="input"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 text-sm"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleTryDemo}
            disabled={demoLoading || loading}
            className="w-full border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 text-sm"
          >
            {demoLoading ? "Loading demo…" : "Try Demo — no account needed →"}
          </button>
        </div>

        <p className="text-sm text-gray-500 text-center mt-5">
          No account yet?{" "}
          <Link href="/signup" className="text-gray-900 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
