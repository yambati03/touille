"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { useTimer } from "@/components/TimerProvider";

export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
  notes: string | null;
}

export interface Step {
  order: number;
  instruction: string;
  duration_minutes: number | null;
  require_timer?: boolean;
}

export interface Modification {
  what: string;
  why: string;
}

export interface Recipe {
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
  modifications?: Modification[];
}

function formatQuantity(ing: Ingredient): string | null {
  if (ing.amount == null && !ing.unit) return null;
  const parts: string[] = [];
  if (ing.amount != null) parts.push(String(ing.amount));
  if (ing.unit) parts.push(ing.unit);
  return parts.join(" ");
}

function capitalizeWords(s: string): string {
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
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

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { startTimer } = useTimer();
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

  const startStepTimer = (step: Step) => {
    const label = `Step ${step.order}`;
    const minutes = step.duration_minutes ?? 5;
    startTimer(minutes, label);
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading || chatStep == null) return;
    const userMsg = chatInput.trim();
    const history = chatMessages;
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
          history: history.map((m) => ({ role: m.role, content: m.text })),
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

  const cardClass = "overflow-hidden rounded-lg bg-card shadow-lg shadow-espresso/[0.04] ring-1 ring-border/50";

  const modifications = recipe.modifications?.length
    ? recipe.modifications
    : [];

  return (
    <>
      <div className="space-y-4">
        {/* Changes for your preferences */}
        {modifications.length > 0 && (
          <div className={`${cardClass} bg-sage/[0.06]`}>
            <div className="px-8 py-6">
              <h4
                className="mb-3 text-lg text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Changes for your preferences
              </h4>
              <ul className="space-y-2">
                {modifications.map((m, i) => (
                  <li key={i} className="flex flex-col gap-0.5 text-sm">
                    <span
                      className="font-medium text-espresso"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {m.what}
                    </span>
                    <span
                      className="text-warm-gray"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {m.why}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Overview card: title, description, equipment, time, ingredients */}
        <div className={cardClass}>
          <div className="border-b border-border/50 px-8 pb-6 pt-8">
            <h3
              className="text-2xl font-bold text-espresso sm:text-3xl"
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
            {recipe.equipment.length > 0 && (
              <div className="mt-4">
                <h4
                  className="mb-2 text-sm font-semibold uppercase tracking-wide text-warm-gray"
                  style={{ fontFamily: "var(--font-accent)" }}
                >
                  Equipment
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recipe.equipment.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-border bg-cream-dark/40 px-3 py-1.5 text-xs font-medium text-espresso"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {item
                        .split(" ")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                        .join(" ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(recipe.times || recipe.servings?.amount) && (
            <div className="flex flex-wrap gap-4 border-t border-border/30 bg-cream-dark/30 px-8 py-4">
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
        </div>

        {/* Ingredients card */}
        <div className={cardClass}>
          <div className="px-8 py-6">
            <h4
              className="mb-4 text-lg text-espresso"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ingredients
            </h4>
            <div className="space-y-1.5">
              {[...recipe.ingredients].sort((a, b) => {
                const aHas = a.amount != null || a.unit ? 0 : 1;
                const bHas = b.amount != null || b.unit ? 0 : 1;
                return aHas - bHas;
              }).map((ing, i) => {
                const qty = formatQuantity(ing);
                const rawAmount = qty ?? (ing.notes?.toLowerCase() === "to taste" ? "to taste" : "");
                const amountDisplay = rawAmount && rawAmount.toLowerCase() === "to taste" ? "To Taste" : rawAmount;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[6rem_auto_1fr] gap-x-3 rounded-md bg-cream-dark/50 px-3 py-2 text-sm"
                  >
                    <span
                      className="font-semibold tabular-nums text-terracotta"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {amountDisplay}
                    </span>
                    <span className="text-espresso" style={{ fontFamily: "var(--font-accent)" }}>
                      {capitalizeWords(ing.name)}
                    </span>
                    <span
                      className="whitespace-nowrap text-right text-warm-gray/70 italic"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {ing.notes && ing.notes.toLowerCase() !== "to taste"
                        ? ing.notes
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step cards */}
        {recipe.steps.map((step) => {
          const done = completedSteps.has(step.order);
          return (
            <div key={step.order} className={cardClass}>
              <div className="flex items-center gap-4 px-6 py-5">
                <button
                  onClick={() => toggleStep(step.order)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    done
                      ? "bg-terracotta text-white"
                      : "bg-terracotta/10 text-terracotta hover:bg-terracotta/20"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                  title={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done ? "✓" : step.order}
                </button>
                <div className={`min-w-0 flex-1 ${done ? "opacity-50" : ""}`}>
                  <p
                    className={`text-sm leading-relaxed text-espresso ${done ? "line-through" : ""}`}
                    style={{ fontFamily: "var(--font-accent)" }}
                  >
                    {step.instruction}
                  </p>
                  {step.duration_minutes != null && (
                    <p
                      className="mt-1.5 flex items-center gap-1 text-xs text-warm-gray"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      <span>⏱</span> ~{step.duration_minutes} min
                    </p>
                  )}
                </div>
                {step.require_timer && (
                  <button
                    onClick={() => startStepTimer(step)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-dark/60 text-lg text-sage transition-all hover:bg-terracotta/10 hover:text-terracotta"
                    title="Start timer"
                  >
                    ⏱
                  </button>
                )}
                <button
                  onClick={() => openChat(step.order)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-dark/60 text-lg text-sage transition-all hover:bg-terracotta/10 hover:text-terracotta"
                  title="Ask about this step"
                >
                  ✦
                </button>
              </div>
            </div>
          );
        })}

        {/* Notes card */}
        {recipe.notes && (
          <div className={`${cardClass} bg-saffron/[0.04]`}>
            <div className="px-8 py-6">
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
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {chatStep !== null && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: "rgba(59, 39, 22, 0.3)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatStep(null);
          }}
        >
          <div
            className="animate-fade-up mx-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-card shadow-2xl ring-1 ring-border/50"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-6 py-4">
              {chatMessages.length === 0 && !chatLoading && (
                <div className="py-8 text-center">
                  <span className="mb-3 inline-block text-3xl">✦</span>
                  <p className="text-sm text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                    Ask anything about this step: troubleshooting, substitutions, technique tips...
                  </p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={i > 0 ? "mt-4" : ""}>
                  {msg.role === "user" ? (
                    <p
                      className="rounded-md bg-cream-dark/70 px-3 py-2 text-sm font-semibold text-espresso"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      {msg.text}
                    </p>
                  ) : (
                    <div
                      className="chat-prose mt-1.5 text-sm leading-relaxed text-warm-gray"
                      style={{ fontFamily: "var(--font-accent)" }}
                    >
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
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
                  className="flex-1 rounded-md bg-cream-dark/50 px-4 py-2.5 text-sm text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:opacity-50"
                  style={{ fontFamily: "var(--font-accent)" }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="rounded-md bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-terracotta/90 disabled:opacity-40"
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
