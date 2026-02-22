"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { authClient } from "@/lib/auth-client";

interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
}

interface Step {
  order: number;
  instruction: string;
  duration_minutes: number | null;
}

interface Recipe {
  title: string;
  description: string | null;
  servings: { amount: number | null; unit: string | null } | null;
  times: {
    prep_minutes: number | null;
    cook_minutes: number | null;
    total_minutes: number | null;
  } | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  equipment: string[];
  notes: string | null;
}

interface ProcessResponse {
  transcript: string;
  caption: string | null;
  recipe: Recipe;
}

interface SavedRecipe {
  id: number;
  url: string;
  recipe: Recipe;
  created_at: string;
}

type Status = "idle" | "loading" | "done" | "error";

const EMOJI_ICONS = ["🍳", "🥘", "🍜", "🥗", "🍰", "🫕", "🥖", "🍲"];

function formatQuantity(ing: Ingredient): string | null {
  if (ing.amount == null && !ing.unit) return null;
  const parts: string[] = [];
  if (ing.amount != null) parts.push(String(ing.amount));
  if (ing.unit) parts.push(ing.unit);
  return parts.join(" ");
}

export default function Home() {
  const { data: session, isPending: sessionLoading } =
    authClient.useSession();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState<ProcessResponse | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"recipe" | "transcript" | "caption">("recipe");

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
    setSelectedRecipe(null);
    setActiveTab("recipe");

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
      setData(json);
      setStatus("done");
      loadRecipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  const displayRecipe = selectedRecipe?.recipe ?? (status === "done" && data ? data.recipe : null);

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
          <div className="flex items-center gap-2.5">
            <h1
              className="text-2xl font-bold tracking-wide text-espresso"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Touille
            </h1>
          </div>
          {sessionLoading ? null : session?.user ? (
            <div className="flex items-center gap-3">
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
                className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-warm-gray transition-all hover:border-terracotta/40 hover:text-terracotta"
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
              className="rounded-full bg-espresso px-5 py-2 text-sm font-medium text-cream transition-all hover:bg-espresso/90 hover:shadow-lg hover:shadow-espresso/20"
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
              <span className="text-terracotta">cook something real</span>
            </h2>
            <p
              className="mx-auto mt-5 max-w-md text-base leading-relaxed text-warm-gray"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Drop a TikTok URL and we&apos;ll pull out the full recipe —
              ingredients, steps, times, and all.
            </p>
          </div>
        </section>

        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className="animate-fade-up stagger-2 mx-auto max-w-2xl"
        >
          <div className="flex gap-3 rounded-2xl bg-card p-2.5 shadow-xl shadow-espresso/[0.04] ring-1 ring-border/70 transition-all focus-within:ring-2 focus-within:ring-terracotta/40">
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
              className="rounded-xl bg-terracotta px-6 py-3 text-sm font-semibold text-cream transition-all hover:bg-terracotta/90 hover:shadow-lg hover:shadow-terracotta/25 disabled:opacity-50 disabled:hover:shadow-none"
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
          <div className="mx-auto mt-10 max-w-2xl animate-fade-up rounded-2xl border border-red-200 bg-red-50/80 px-6 py-4">
            <p className="text-sm text-red-700" style={{ fontFamily: "var(--font-accent)" }}>
              {error}
            </p>
          </div>
        )}

        {/* Result with tabs */}
        {status === "done" && data && !selectedRecipe && (
          <div className="mt-12 animate-fade-up">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex justify-center gap-1 rounded-full bg-cream-dark/60 p-1">
                {(["recipe", "transcript", "caption"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-5 py-2 text-sm font-medium capitalize transition-all ${
                      activeTab === tab
                        ? "bg-card text-espresso shadow-sm"
                        : "text-warm-gray hover:text-espresso"
                    }`}
                    style={{ fontFamily: "var(--font-accent)" }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "recipe" && (
                <RecipeCard recipe={data.recipe} />
              )}

              {activeTab === "transcript" && (
                <div className="rounded-2xl bg-card p-8 shadow-lg shadow-espresso/[0.03] ring-1 ring-border/50">
                  <h3
                    className="mb-4 text-lg text-espresso"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Transcript
                  </h3>
                  <p
                    className="whitespace-pre-wrap text-sm leading-relaxed text-warm-gray"
                    style={{ fontFamily: "var(--font-accent)" }}
                  >
                    {data.transcript}
                  </p>
                </div>
              )}

              {activeTab === "caption" && (
                <div className="rounded-2xl bg-card p-8 shadow-lg shadow-espresso/[0.03] ring-1 ring-border/50">
                  <h3
                    className="mb-4 text-lg text-espresso"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Caption
                  </h3>
                  {data.caption ? (
                    <p
                      className="whitespace-pre-wrap text-sm leading-relaxed text-warm-gray"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {data.caption}
                    </p>
                  ) : (
                    <p className="text-sm italic text-warm-gray/60" style={{ fontFamily: "var(--font-accent)" }}>
                      No caption found for this video.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected saved recipe */}
        {selectedRecipe && (
          <div className="mt-12 animate-fade-up">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                  From your saved recipes
                </p>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-warm-gray transition-all hover:border-terracotta/40 hover:text-terracotta"
                  style={{ fontFamily: "var(--font-accent)" }}
                >
                  Close
                </button>
              </div>
              <RecipeCard recipe={selectedRecipe.recipe} />
            </div>
          </div>
        )}

        {/* My Recipes grid */}
        {session?.user && savedRecipes.length > 0 && (
          <section className="mt-20 pb-20 animate-fade-up">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p
                  className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-terracotta"
                  style={{ fontFamily: "var(--font-accent)" }}
                >
                  Your Collection
                </p>
                <h3
                  className="text-3xl text-espresso"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  My Recipes
                </h3>
              </div>
              <p className="text-sm text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                {savedRecipes.length} recipe{savedRecipes.length !== 1 && "s"}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedRecipes.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedRecipe(r);
                    setData(null);
                    setStatus("idle");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`animate-fade-up stagger-${Math.min(i + 1, 6)} group cursor-pointer rounded-2xl bg-card p-5 text-left shadow-md shadow-espresso/[0.03] ring-1 ring-border/50 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-terracotta/[0.08] hover:ring-terracotta/30`}
                >
                  <div className="mb-3 flex items-start justify-between">
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
                  {r.recipe.description && (
                    <p
                      className="mb-3 line-clamp-2 text-xs leading-relaxed text-warm-gray"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {r.recipe.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {r.recipe.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-sage-light/30 px-2.5 py-0.5 text-[10px] font-medium text-sage"
                        style={{ fontFamily: "var(--font-accent)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
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

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [chatStep, setChatStep] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const toggleStep = (order: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
  };

  const openChat = (stepOrder: number) => {
    setChatStep(stepOrder);
    setChatMessages([]);
    setChatInput("");
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading || chatStep == null) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe,
          current_step: chatStep,
          completed_steps: Array.from(completedSteps),
          message: userMsg,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Request failed");
      }

      setChatLoading(false);
      setChatMessages((prev) => [...prev, { role: "assistant", text: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, text: last.text + chunk };
          }
          return updated;
        });
      }
    } catch {
      setChatLoading(false);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong. Please try again." },
      ]);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-card shadow-lg shadow-espresso/[0.04] ring-1 ring-border/50">
        <div className="border-b border-border/50 px-8 pb-6 pt-8">
          <h3
            className="text-2xl text-espresso sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {recipe.title}
          </h3>
          {recipe.description && (
            <p
              className="mt-2 text-sm leading-relaxed text-warm-gray"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              {recipe.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-sage-light/25 px-3 py-1 text-xs font-medium text-sage"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-0">
          {(recipe.times || recipe.servings?.amount) && (
            <div className="flex flex-wrap gap-4 border-b border-border/30 bg-cream-dark/30 px-8 py-4">
              {recipe.times?.prep_minutes != null && (
                <TimeChip label="Prep" minutes={recipe.times.prep_minutes} />
              )}
              {recipe.times?.cook_minutes != null && (
                <TimeChip label="Cook" minutes={recipe.times.cook_minutes} />
              )}
              {recipe.times?.total_minutes != null && (
                <TimeChip label="Total" minutes={recipe.times.total_minutes} />
              )}
              {recipe.servings?.amount && (
                <div className="flex items-center gap-1.5 text-sm text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                  <span className="text-base">🍽</span>
                  <span className="font-semibold text-espresso">{recipe.servings.amount}</span>
                  {recipe.servings.unit}
                </div>
              )}
            </div>
          )}

          {/* Ingredients */}
          <div className="border-b border-border/30 px-8 py-6">
            <h4
              className="mb-4 text-lg text-espresso"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ingredients
            </h4>
            <div className="grid grid-cols-[6rem_auto_1fr] gap-x-3 gap-y-2 text-sm">
              {[...recipe.ingredients].sort((a, b) => {
                const aHas = a.amount != null || a.unit ? 0 : 1;
                const bHas = b.amount != null || b.unit ? 0 : 1;
                return aHas - bHas;
              }).map((ing, i) => {
                const qty = formatQuantity(ing);
                return (
                  <div key={i} className="contents">
                    <span
                      className="text-right font-semibold tabular-nums text-terracotta"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {qty ?? ""}
                    </span>
                    <span className="text-espresso" style={{ fontFamily: "var(--font-accent)" }}>
                      {ing.name}
                    </span>
                    <span
                      className="whitespace-nowrap text-warm-gray/70 italic"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {ing.notes ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div className="px-8 py-6">
            <h4
              className="mb-5 text-lg text-espresso"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Steps
            </h4>
            <ol className="space-y-5">
              {recipe.steps.map((step) => {
                const done = completedSteps.has(step.order);
                return (
                  <li key={step.order} className="flex gap-4">
                    <button
                      onClick={() => toggleStep(step.order)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        done
                          ? "bg-terracotta text-white"
                          : "bg-terracotta/10 text-terracotta hover:bg-terracotta/20"
                      }`}
                      style={{ fontFamily: "var(--font-display)" }}
                      title={done ? "Mark incomplete" : "Mark complete"}
                    >
                      {done ? "✓" : step.order}
                    </button>
                    <div className={`flex-1 pt-0.5 ${done ? "opacity-50" : ""}`}>
                      <p
                        className={`text-sm leading-relaxed text-espresso ${done ? "line-through" : ""}`}
                        style={{ fontFamily: "var(--font-accent)" }}
                      >
                        {step.instruction}
                      </p>
                      {step.duration_minutes != null && (
                        <p
                          className="mt-1 flex items-center gap-1 text-xs text-warm-gray"
                          style={{ fontFamily: "var(--font-accent)" }}
                        >
                          <span>⏱</span> ~{step.duration_minutes} min
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => openChat(step.order)}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base text-warm-gray/40 transition-all hover:bg-sage-light/20 hover:text-sage"
                      title="Ask about this step"
                    >
                      ✦
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Equipment */}
          {recipe.equipment.length > 0 && (
            <div className="border-t border-border/30 px-8 py-6">
              <h4
                className="mb-3 text-lg text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Equipment
              </h4>
              <div className="flex flex-wrap gap-2">
                {recipe.equipment.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border bg-cream-dark/40 px-3.5 py-1.5 text-xs font-medium text-warm-gray"
                    style={{ fontFamily: "var(--font-accent)" }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {recipe.notes && (
            <div className="border-t border-border/30 bg-saffron/[0.04] px-8 py-6">
              <h4
                className="mb-2 text-lg text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Notes
              </h4>
              <p
                className="text-sm leading-relaxed text-warm-gray"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                {recipe.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Modal — portaled to document.body so backdrop-blur covers the entire screen */}
      {chatStep !== null && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: "rgba(59, 39, 22, 0.3)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatStep(null);
          }}
        >
          <div
            className="animate-fade-up mx-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
              <div>
                <h4
                  className="text-base text-espresso"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Ask about Step {chatStep}
                </h4>
                <p className="mt-0.5 text-xs text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                  {recipe.steps.find((s) => s.order === chatStep)?.instruction.slice(0, 60)}
                  {(recipe.steps.find((s) => s.order === chatStep)?.instruction.length ?? 0) > 60 ? "..." : ""}
                </p>
              </div>
              <button
                onClick={() => setChatStep(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-warm-gray transition-all hover:bg-cream-dark hover:text-espresso"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-6 py-4">
              {chatMessages.length === 0 && !chatLoading && (
                <div className="py-8 text-center">
                  <span className="mb-3 inline-block text-3xl">✦</span>
                  <p className="text-sm text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                    Ask anything about this step — troubleshooting, substitutions, technique tips...
                  </p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={i > 0 ? "mt-4" : ""}>
                  {msg.role === "user" ? (
                    <p
                      className="text-sm font-semibold text-espresso"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {msg.text}
                    </p>
                  ) : (
                    <p
                      className="mt-1.5 text-sm leading-relaxed text-warm-gray"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {msg.text}
                    </p>
                  )}
                  {msg.role === "assistant" && i < chatMessages.length - 1 && (
                    <div className="mt-4 border-b border-border/30" />
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="mt-4">
                  <span
                    className="thinking-shimmer text-sm font-medium"
                    style={{ fontFamily: "var(--font-accent)" }}
                  >
                    Thinking...
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border/50 px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="My batter feels too watery..."
                  disabled={chatLoading}
                  className="flex-1 rounded-xl bg-cream-dark/50 px-4 py-2.5 text-sm text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:opacity-50"
                  style={{ fontFamily: "var(--font-accent)" }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-terracotta/90 disabled:opacity-40"
                  style={{ fontFamily: "var(--font-accent)" }}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function TimeChip({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div
      className="flex items-center gap-1.5 text-sm text-warm-gray"
      style={{ fontFamily: "var(--font-accent)" }}
    >
      <span className="text-base">⏱</span>
      <span className="font-semibold text-espresso">{minutes}</span>
      min
      <span className="text-warm-gray/50">({label})</span>
    </div>
  );
}
