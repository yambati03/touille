"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RecipeCard, type Recipe } from "@/components/RecipeCard";

interface SavedRecipe {
  id: number;
  url: string;
  recipe: Recipe;
  created_at: string;
}

export default function RecipePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [recipe, setRecipe] = useState<SavedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recipes/${id}`);
        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/");
            return;
          }
          if (res.status === 404) {
            setError("Recipe not found");
            return;
          }
          throw new Error("Failed to load recipe");
        }
        const data: SavedRecipe = await res.json();
        if (!cancelled) setRecipe(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <div className="grain-overlay" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-12">
          <div className="flex items-center gap-2 text-warm-gray" style={{ fontFamily: "var(--font-accent)" }}>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-terracotta/30 border-t-terracotta" />
            Loading recipe...
          </div>
        </div>
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <div className="grain-overlay" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm text-red-600" style={{ fontFamily: "var(--font-accent)" }}>
            {error ?? "Recipe not found"}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grain-overlay" />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 rounded-md border border-border bg-cream-dark/60 px-4 py-2 text-sm font-medium text-warm-gray transition-all hover:border-terracotta/40 hover:text-terracotta"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          ← Back to My Recipes
        </Link>
        <RecipeCard recipe={recipe.recipe} recipeId={recipe.id} />
      </div>
    </main>
  );
}
