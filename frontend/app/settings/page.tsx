"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface Settings {
  user_id: string;
  dietary_restrictions: string | null;
  spice_tolerance: number;
  custom_rules: string | null;
  updated_at: string | null;
}

const SPICE_LABELS = [
  "None",
  "Low",
  "Medium",
  "Medium–high",
  "High",
  "Very high",
];

const SPICE_INSET = 10;

function spiceThumbLeftPercent(value: number) {
  return value === 0
    ? SPICE_INSET
    : value === 5
      ? 100 - SPICE_INSET
      : SPICE_INSET + ((100 - 2 * SPICE_INSET) * value) / 5;
}

function percentToSpiceValue(percent: number): number {
  if (percent <= SPICE_INSET) return 0;
  if (percent >= 100 - SPICE_INSET) return 5;
  const v = ((percent - SPICE_INSET) / (100 - 2 * SPICE_INSET)) * 5;
  return Math.round(Math.max(0, Math.min(5, v)));
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } =
    authClient.useSession();

  const [dietary, setDietary] = useState("");
  const [spiceTolerance, setSpiceTolerance] = useState(2);
  const [customRules, setCustomRules] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const spiceTrackRef = useRef<HTMLDivElement>(null);

  const setSpiceFromEvent = useCallback((e: React.MouseEvent | React.PointerEvent | PointerEvent) => {
    const el = spiceTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    setSpiceTolerance(percentToSpiceValue(percent));
  }, []);

  useEffect(() => {
    if (!session?.user) {
      if (!sessionLoading) router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to load");
        const data: Settings | null = await res.json();
        if (cancelled) return;
        if (data) {
          setDietary(data.dietary_restrictions ?? "");
          setSpiceTolerance(
            typeof data.spice_tolerance === "number"
              ? Math.min(5, Math.max(0, data.spice_tolerance))
              : 2,
          );
          setCustomRules(data.custom_rules ?? "");
        }
      } catch {
        if (!cancelled) setMessage("error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, sessionLoading, router]);

  async function handleSave() {
    if (!session?.user) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dietary_restrictions: dietary.trim() || null,
          spice_tolerance: spiceTolerance,
          custom_rules: customRules.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("saved");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("error");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || (!session?.user && loading)) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <div className="grain-overlay" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-2 text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-terracotta/30 border-t-terracotta" />
            Loading...
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return null;
  }

  const cardClass =
    "overflow-hidden rounded-lg bg-card shadow-lg shadow-espresso/[0.04] ring-1 ring-border/50";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grain-overlay" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-md border border-border bg-cream-dark/60 px-4 py-2 text-sm font-medium text-warm-gray transition-all hover:border-terracotta/40 hover:text-terracotta"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          ← Back to home
        </Link>

        <h1
          className="mb-2 text-2xl text-espresso sm:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Recipe preferences
        </h1>
        <p
          className="mb-8 text-sm text-warm-gray"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          We use these when extracting recipes so they fit your diet and taste.
        </p>

        <div className="space-y-6">
          {/* Dietary restrictions */}
          <div className={cardClass}>
            <div className="px-8 py-6">
              <h2
                className="mb-2 text-lg text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Do you have any allergies or dietary restrictions?
              </h2>
              <p
                className="mb-4 text-xs text-warm-gray"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                e.g. gluten-free, nut allergy, vegetarian, no dairy
              </p>
              <textarea
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                placeholder="None, or describe..."
                rows={3}
                className="w-full rounded-md border border-border bg-cream-dark/50 px-4 py-3 text-sm text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                style={{ fontFamily: "var(--font-accent)" }}
              />
            </div>
          </div>

          {/* Spice tolerance */}
          <div className={cardClass}>
            <div className="px-8 py-6">
              <h2
                className="mb-2 text-lg text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Spice tolerance
              </h2>
              <p
                className="mb-4 text-xs text-warm-gray"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                We&apos;ll adjust chili and hot spices in recipes to match.
              </p>
              <div className="flex flex-col gap-3">
                <div
                  ref={spiceTrackRef}
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={spiceTolerance}
                  aria-valuetext={SPICE_LABELS[spiceTolerance]}
                  tabIndex={0}
                  className="relative flex h-8 w-full cursor-pointer items-center"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setSpiceFromEvent(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons !== 1) return;
                    setSpiceFromEvent(e);
                  }}
                  onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
                  onPointerLeave={(e) => {
                    if (e.buttons === 0) return;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onClick={(e) => setSpiceFromEvent(e)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                      e.preventDefault();
                      setSpiceTolerance((v) => Math.max(0, v - 1));
                    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                      e.preventDefault();
                      setSpiceTolerance((v) => Math.min(5, v + 1));
                    }
                  }}
                >
                  <div
                    className="h-2 w-full rounded-full bg-cream-dark"
                    style={{
                      marginLeft: `${SPICE_INSET}%`,
                      marginRight: `${SPICE_INSET}%`,
                      width: `${100 - 2 * SPICE_INSET}%`,
                    }}
                  />
                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-terracotta shadow-md ring-2 ring-white"
                    style={{ left: `${spiceThumbLeftPercent(spiceTolerance)}%` }}
                  />
                </div>
                <div className="relative min-h-5 w-full text-xs text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
                  {SPICE_LABELS.map((label, i) => (
                    <span
                      key={label}
                      className={`absolute -translate-x-1/2 whitespace-nowrap ${i === spiceTolerance ? "font-semibold text-terracotta" : ""}`}
                      style={{ left: `${spiceThumbLeftPercent(i)}%` }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Custom rules */}
          <div className={cardClass}>
            <div className="px-8 py-6">
              <h2
                className="mb-2 text-lg text-espresso"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Any other rules?
              </h2>
              <p
                className="mb-4 text-xs text-warm-gray"
                style={{ fontFamily: "var(--font-accent)" }}
              >
                Optional. e.g. &quot;prefer metric&quot;, &quot;avoid deep frying&quot;
              </p>
              <textarea
                value={customRules}
                onChange={(e) => setCustomRules(e.target.value)}
                placeholder="Optional..."
                rows={2}
                className="w-full rounded-md border border-border bg-cream-dark/50 px-4 py-3 text-sm text-espresso placeholder:text-warm-gray/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                style={{ fontFamily: "var(--font-accent)" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-terracotta px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-terracotta/90 disabled:opacity-50"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              {saving ? "Saving..." : "Save preferences"}
            </button>
            {message === "saved" && (
              <span className="text-sm text-sage" style={{ fontFamily: "var(--font-accent)" }}>
                Saved.
              </span>
            )}
            {message === "error" && (
              <span className="text-sm text-red-600" style={{ fontFamily: "var(--font-accent)" }}>
                Something went wrong. Try again.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
