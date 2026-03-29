import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import RecipeEditor from "@/components/recipe-editor";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

type RecipeSummary = {
  id: string;
  title: string;
  updatedAt: Date;
};

function formatRelativeTime(date: Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export default function Notes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!session && !sessionPending) navigate("/login");
  }, [session, sessionPending, navigate]);

  const { data: recipes = [], isLoading } = useQuery(
    trpc.recipe.list.queryOptions(),
  );

  const { data: selectedRecipe } = useQuery({
    ...trpc.recipe.get.queryOptions({ id: selectedId ?? "" }),
    enabled: !!selectedId,
  });

  const createMutation = useMutation(
    trpc.recipe.create.mutationOptions({
      onSuccess: (recipe) => {
        queryClient.invalidateQueries(trpc.recipe.list.queryOptions());
        setSelectedId(recipe.id);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const deleteMutation = useMutation(
    trpc.recipe.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.recipe.list.queryOptions());
        setSelectedId(null);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  // Auto-select first recipe on load
  useEffect(() => {
    if (!selectedId && recipes.length > 0) {
      setSelectedId(recipes[0].id);
    }
  }, [recipes, selectedId]);

  const filtered = recipes.filter((r: RecipeSummary) =>
    r.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Check if user has a Google account linked (for Drive sync button)
  const hasGoogleAccount = session?.user
    ? (session.user as { accounts?: { providerId: string }[] }).accounts?.some(
        (a) => a.providerId === "google",
      ) ?? false
    : false;

  if (sessionPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--panel-bg)]">
        <span className="text-sm text-[#b0a898]">Loading…</span>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "#fafaf5" }}
    >
      {/* Top header */}
      <header
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: "var(--header-bg)", color: "#fff" }}
      >
        <div className="flex items-center gap-4">
          {/* Back button — greyed out, home page doesn't exist yet */}
          <button
            disabled
            className="flex items-center gap-1 text-sm opacity-30 cursor-not-allowed"
            title="Home (coming soon)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Home
          </button>

          <span
            className="font-bold text-base tracking-tight"
            style={{ color: "var(--brand-yellow)" }}
          >
            Recipe Notes
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs opacity-50">{session?.user.name}</span>
          <button
            onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => navigate("/login") } })}
            className="text-xs opacity-60 hover:opacity-100 transition-opacity"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — recipe list */}
        <aside
          className="w-72 flex-shrink-0 flex flex-col border-r overflow-hidden"
          style={{
            background: "var(--panel-bg)",
            borderColor: "var(--panel-border)",
          }}
        >
          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded bg-white border outline-none placeholder:text-[#b0a898] focus:border-[var(--brand-yellow)] transition-colors"
                style={{ borderColor: "var(--panel-border)" }}
              />
            </div>
          </div>

          {/* New recipe button */}
          <div className="px-3 pb-2">
            <button
              onClick={() => createMutation.mutate({})}
              disabled={createMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded border border-dashed transition-colors hover:border-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-light)] disabled:opacity-50"
              style={{ borderColor: "var(--panel-border)", color: "#6b6055" }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Recipe
            </button>
          </div>

          {/* Recipe list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-center text-[#b0a898] mt-8">
                Loading…
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-center text-[#b0a898] mt-8 px-4">
                {search ? "No matches" : "No recipes yet"}
              </p>
            ) : (
              filtered.map((r: RecipeSummary) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="w-full text-left px-4 py-3 border-b transition-colors group relative"
                  style={{
                    borderColor: "var(--panel-border)",
                    background:
                      selectedId === r.id
                        ? "var(--brand-yellow)"
                        : "transparent",
                    color: selectedId === r.id ? "#1a1a1a" : "#2d2a24",
                  }}
                >
                  <p className="text-sm font-semibold truncate leading-tight">
                    {r.title}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color: selectedId === r.id ? "#5a4f00" : "#b0a898",
                    }}
                  >
                    {formatRelativeTime(r.updatedAt)}
                  </p>

                  {/* Delete button */}
                  {selectedId === r.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this recipe?")) {
                          deleteMutation.mutate({ id: r.id });
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-[#1a1a1a]"
                      title="Delete"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right panel — editor */}
        <main className="flex-1 bg-white overflow-hidden">
          {selectedRecipe ? (
            <RecipeEditor
              recipe={selectedRecipe}
              hasGoogleAccount={hasGoogleAccount}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <span
                className="text-5xl font-bold tracking-tight"
                style={{ color: "var(--brand-yellow)" }}
              >
                ✦
              </span>
              <p className="text-sm text-[#b0a898]">
                {recipes.length === 0
                  ? "Create your first recipe"
                  : "Select a recipe to edit"}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
