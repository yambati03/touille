"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [data, setData] = useState<ProcessResponse | null>(null);

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
      setData(json);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  const formatAmount = (ing: Ingredient) => {
    const parts: string[] = [];
    if (ing.amount != null) parts.push(String(ing.amount));
    if (ing.unit) parts.push(ing.unit);
    parts.push(ing.name);
    if (ing.notes) parts.push(`(${ing.notes})`);
    return parts.join(" ");
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Touille</h1>
          <p className="mt-2 text-muted-foreground">
            Paste a TikTok link, get a structured recipe.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            type="url"
            placeholder="https://www.tiktok.com/@user/video/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={status === "loading"}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Processing..." : "Extract"}
          </Button>
        </form>

        {status === "loading" && (
          <div className="mt-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Downloading, transcribing &amp; extracting — this may take a
              minute...
            </p>
          </div>
        )}

        {status === "error" && (
          <Card className="mt-8 border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {status === "done" && data && (
          <div className="mt-10 space-y-6">
            <Tabs defaultValue="recipe">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recipe">Recipe</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="caption">Caption</TabsTrigger>
              </TabsList>

              <TabsContent value="recipe" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      {data.recipe.title}
                    </CardTitle>
                    {data.recipe.description && (
                      <CardDescription>
                        {data.recipe.description}
                      </CardDescription>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {data.recipe.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {data.recipe.times && (
                      <div className="flex gap-6 text-sm">
                        {data.recipe.times.prep_minutes != null && (
                          <div>
                            <span className="font-medium">Prep:</span>{" "}
                            {data.recipe.times.prep_minutes} min
                          </div>
                        )}
                        {data.recipe.times.cook_minutes != null && (
                          <div>
                            <span className="font-medium">Cook:</span>{" "}
                            {data.recipe.times.cook_minutes} min
                          </div>
                        )}
                        {data.recipe.times.total_minutes != null && (
                          <div>
                            <span className="font-medium">Total:</span>{" "}
                            {data.recipe.times.total_minutes} min
                          </div>
                        )}
                      </div>
                    )}

                    {data.recipe.servings && data.recipe.servings.amount && (
                      <p className="text-sm">
                        <span className="font-medium">Servings:</span>{" "}
                        {data.recipe.servings.amount}{" "}
                        {data.recipe.servings.unit}
                      </p>
                    )}

                    <Separator />

                    <div>
                      <h3 className="mb-3 text-lg font-semibold">
                        Ingredients
                      </h3>
                      <ul className="space-y-1.5 text-sm">
                        {data.recipe.ingredients.map((ing, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {formatAmount(ing)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="mb-3 text-lg font-semibold">Steps</h3>
                      <ol className="space-y-3 text-sm">
                        {data.recipe.steps.map((step) => (
                          <li key={step.order} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                              {step.order}
                            </span>
                            <div>
                              <p>{step.instruction}</p>
                              {step.duration_minutes != null && (
                                <p className="mt-0.5 text-muted-foreground">
                                  ~{step.duration_minutes} min
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {data.recipe.equipment.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="mb-3 text-lg font-semibold">
                            Equipment
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {data.recipe.equipment.map((item) => (
                              <Badge key={item} variant="outline">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {data.recipe.notes && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="mb-2 text-lg font-semibold">Notes</h3>
                          <p className="text-sm text-muted-foreground">
                            {data.recipe.notes}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transcript" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Transcript</CardTitle>
                    <CardDescription>
                      Raw audio transcription from the video
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {data.transcript}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="caption" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Caption</CardTitle>
                    <CardDescription>
                      Original TikTok video caption
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.caption ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {data.caption}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No caption found for this video.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  );
}
