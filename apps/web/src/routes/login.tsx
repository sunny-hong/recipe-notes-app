import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await authClient.signIn.email(
          { email, password },
          {
            onSuccess: () => navigate("/dashboard"),
            onError: (err) =>
              toast.error(err.error.message || err.error.statusText),
          },
        );
      } else {
        await authClient.signUp.email(
          { email, password, name },
          {
            onSuccess: () => navigate("/dashboard"),
            onError: (err) =>
              toast.error(err.error.message || err.error.statusText),
          },
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    await authClient.signIn.social(
      { provider: "google", callbackURL: `${window.location.origin}/dashboard` },
      { onError: (err) => toast.error(err.error.message) },
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#fafaf5", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      {/* Top bar */}
      <header
        className="flex items-center px-8 py-4"
        style={{ background: "#2d2a24" }}
      >
        <span
          className="font-bold text-base tracking-tight"
          style={{ color: "#f5c518" }}
        >
          Recipe Notes
        </span>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm bg-white border p-8"
          style={{ borderColor: "#e5ddd0" }}
        >
          {/* Heading */}
          <div className="mb-6">
            <div
              className="w-8 h-1 mb-4"
              style={{ background: "#f5c518" }}
            />
            <h1 className="text-2xl font-bold text-[#1a1a1a] leading-tight">
              {mode === "signin" ? "Welcome back." : "Create account."}
            </h1>
            <p className="text-sm text-[#b0a898] mt-1">
              {mode === "signin"
                ? "Sign in to your recipe notes."
                : "Start collecting your recipes."}
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border text-sm font-medium text-[#2d2a24] transition-colors hover:bg-[#fdf3c2] hover:border-[#f5c518] mb-4"
            style={{ borderColor: "#e5ddd0" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: "#e5ddd0" }} />
            <span className="text-xs text-[#b0a898]">or</span>
            <div className="flex-1 h-px" style={{ background: "#e5ddd0" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-[#6b6055] mb-1 uppercase tracking-wide">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border outline-none focus:border-[#f5c518] transition-colors"
                  style={{ borderColor: "#e5ddd0" }}
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#6b6055] mb-1 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border outline-none focus:border-[#f5c518] transition-colors"
                style={{ borderColor: "#e5ddd0" }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b6055] mb-1 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 text-sm border outline-none focus:border-[#f5c518] transition-colors"
                style={{ borderColor: "#e5ddd0" }}
                placeholder="Min. 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-bold text-[#1a1a1a] transition-opacity disabled:opacity-50"
              style={{ background: "#f5c518" }}
            >
              {loading
                ? "…"
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-xs text-center text-[#b0a898] mt-4">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-[#1a1a1a] font-semibold hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have one?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-[#1a1a1a] font-semibold hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
