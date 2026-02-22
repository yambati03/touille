"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { RecipeCard, type Recipe } from "@/components/RecipeCard";

interface ProcessResponse {
  transcript: string;
  caption: string | null;
  recipe: Recipe;
  recipe_id?: number | null;
}

interface SavedRecipe {
  id: number;
  url: string;
  recipe: Recipe;
  created_at: string;
}

type Status = "idle" | "loading" | "done" | "error";

const EMOJI_ICONS = ["🍳", "🥘", "🍜", "🥗", "🍰", "🫕", "🥖", "🍲"];

export default function Home() {
  const { data: session, isPending: sessionLoading } =
    authClient.useSession();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState<ProcessResponse | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const router = useRouter();

  const loadRecipes = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/recipes");
      if (res.ok) {
        const json = await res.json();
        setSavedRecipes(json);
      }
    } catch {}
  }, [session?.user]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus("loading");
    setError("");
    setData(null);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed (${res.status})`);
      }

      const json: ProcessResponse = await res.json();
      if (json.recipe_id != null && session?.user) {
        loadRecipes();
        router.push(`/recipes/${json.recipe_id}`);
        return;
      }
      setData(json);
      setStatus("done");
      loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grain-overlay" />

      {/* Decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-terracotta/[0.07] blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-saffron/[0.08] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sage/[0.06] blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => {
              setData(null);
              setStatus("idle");
            }}
          >
            <h1
              className="text-2xl font-bold tracking-wide text-espresso"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Touille
            </h1>
          </Link>
          {sessionLoading ? null : session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/settings"
                className="text-sm font-medium text-warm-gray transition-colors hover:text-terracotta"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                Settings
              </Link>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/10 text-sm font-semibold text-terracotta">
                {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
              </div>
              <span
                className="hidden text-sm text-warm-gray sm:block"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => authClient.signOut()}
                className="rounded-md border border-border px-3.5 py-1.5 text-xs font-medium text-warm-gray transition-all hover:border-terracotta/40 hover:text-terracotta"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                authClient.signIn.social({ provider: "google" })
              }
              className="rounded-md bg-terracotta px-5 py-2 text-sm font-medium text-white transition-all hover:bg-terracotta/90 hover:shadow-lg hover:shadow-terracotta/20"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-4xl px-6">
        {/* Hero Section */}
        <section className="pb-10 pt-16 text-center">
          <div className="animate-fade-up">
            <h2
              className="text-5xl leading-tight text-espresso sm:text-6xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Paste a link,
              <br />
              <span className="gradient-hero">cook something real</span>
            </h2>
            <p
              className="mx-auto mt-5 max-w-md text-base leading-relaxed text-warm-gray"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Drop a TikTok URL and we&apos;ll pull out the full recipe:
              ingredients, steps, times, and all.
            </p>
          </div>
        </section>

        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className="animate-fade-up stagger-2 mx-auto max-w-2xl"
        >
          <div className="flex gap-3 rounded-lg bg-card p-2.5 shadow-xl shadow-espresso/[0.04] ring-1 ring-border/70 transition-all focus-within:ring-2 focus-within:ring-terracotta/40">
            <input
              type="url"
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={status === "loading"}
              required
              className="flex-1 bg-transparent px-4 py-3 text-sm text-espresso placeholder:text-warm-gray/50 focus:outline-none disabled:opacity-50"
              style={{ fontFamily: "var(--font-accent)" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-cream transition-all hover:bg-terracotta/90 hover:shadow-lg hover:shadow-terracotta/25 disabled:opacity-50 disabled:hover:shadow-none"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              {status === "loading" ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream" />
                  Working...
                </span>
              ) : (
                "Extract"
              )}
            </button>
          </div>
        </form>

        {/* Loading state */}
        {status === "loading" && (
          <div className="mt-16 text-center animate-fade-up">
            <div className="mx-auto mb-6 flex justify-center gap-3">
              {["🧅", "🍅", "🌿"].map((emoji, i) => (
                <span
                  key={i}
                  className="animate-float text-3xl"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  {emoji}
                </span>
              ))}
            </div>
            <p
              className="text-sm text-warm-gray"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Downloading, transcribing &amp; extracting&hellip;
            </p>
            <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-cream-dark">
              <div className="h-full w-full animate-shimmer rounded-full bg-gradient-to-r from-transparent via-terracotta/40 to-transparent" />
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mx-auto mt-10 max-w-2xl animate-fade-up rounded-lg border border-red-200 bg-red-50/80 px-6 py-4">
            <p className="text-sm text-red-700" style={{ fontFamily: "var(--font-accent)" }}>
              {error}
            </p>
          </div>
        )}

        {/* Result when not redirected (e.g. not logged in, or backend has no recipe_id) */}
        {status === "done" && data && (data.recipe_id == null || !session?.user) && (
          <div className="mt-12 animate-fade-up">
            <div className="mx-auto max-w-3xl">
              <RecipeCard recipe={data.recipe} />
            </div>
          </div>
        )}

        {/* My Recipes grid */}
        {session?.user && savedRecipes.length > 0 && (
          <section className="mt-20 pb-20 animate-fade-up">
            <div className="mb-8 flex items-end justify-between">
              <h3
                className="text-3xl text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                My Recipes
              </h3>
              <p className="text-sm text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                {savedRecipes.length} recipe{savedRecipes.length !== 1 && "s"}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedRecipes.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/recipes/${r.id}`}
                  className={`animate-fade-up stagger-${Math.min(i + 1, 6)} group flex flex-col rounded-lg bg-card p-5 text-left shadow-md shadow-espresso/[0.03] ring-1 ring-border/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-terracotta/[0.08] hover:ring-terracotta/30`}
                >
                  <div className="mb-3 flex w-full items-start justify-between">
                    <span className="text-2xl">
                      {EMOJI_ICONS[r.id % EMOJI_ICONS.length]}
                    </span>
                    <span className="text-xs text-warm-gray/50" style={{ fontFamily: "var(--font-accent)" }}>
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <h4
                    className="mb-1.5 text-base text-espresso group-hover:text-terracotta transition-colors"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {r.recipe.title}
                  </h4>
                  <p
                    className="mb-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-warm-gray"
                    style={{ fontFamily: "var(--font-accent)" }}
                  >
                    {r.recipe.description ?? "\u00A0"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for signed-in users with no recipes */}
        {session?.user && savedRecipes.length === 0 && status === "idle" && (
          <section className="mt-20 pb-20 text-center animate-fade-up">
            <span className="mb-4 inline-block text-5xl animate-float">🥘</span>
            <h3
              className="text-2xl text-espresso"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No recipes yet
            </h3>
            <p
              className="mt-2 text-sm text-warm-gray"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Extract your first recipe from a TikTok link above!
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

