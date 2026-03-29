import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type Recipe = {
  id: string;
  title: string;
  content: Record<string, unknown>;
  googleDriveFileId: string | null;
  updatedAt: Date;
};

type Props = {
  recipe: Recipe;
  hasGoogleAccount: boolean;
};

export default function RecipeEditor({ recipe, hasGoogleAccount }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(recipe.title);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncing = useRef(false);

  const updateMutation = useMutation(
    trpc.recipe.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.recipe.list.queryOptions());
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Start writing your recipe — ingredients, steps, notes, anything…",
      }),
    ],
    content: recipe.content as object,
    onUpdate: ({ editor }) => {
      scheduleSave({ content: editor.getJSON() });
    },
  });

  // Reset editor when recipe changes
  useEffect(() => {
    if (editor && recipe.id) {
      editor.commands.setContent(recipe.content as object);
    }
    setTitle(recipe.title);
  }, [recipe.id]);

  function scheduleSave(partial: { title?: string; content?: object }) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateMutation.mutate({
        id: recipe.id,
        ...partial,
        syncToDrive: false,
      });
    }, 1200);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    scheduleSave({ title: val });
  }

  async function handleSyncToDrive() {
    if (isSyncing.current) return;
    isSyncing.current = true;
    try {
      await updateMutation.mutateAsync({
        id: recipe.id,
        title,
        content: editor?.getJSON() ?? {},
        syncToDrive: true,
      });
      toast.success("Synced to Google Drive");
    } catch {
      // error toast handled by onError
    } finally {
      isSyncing.current = false;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <div className="px-10 pt-8 pb-2 border-b border-[var(--panel-border)]">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Recipe title"
          className="w-full text-2xl font-bold bg-transparent outline-none placeholder:text-[#c5bdb0] text-[#1a1a1a]"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Footer bar */}
      <div className="px-10 py-3 border-t border-[var(--panel-border)] flex items-center justify-between">
        <span className="text-xs text-[#b0a898]">
          {updateMutation.isPending ? "Saving…" : "Auto-saved"}
        </span>
        {hasGoogleAccount && (
          <button
            onClick={handleSyncToDrive}
            disabled={updateMutation.isPending}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded border border-[var(--panel-border)] bg-white hover:bg-[var(--brand-yellow-light)] hover:border-[var(--brand-yellow)] transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Sync to Drive
          </button>
        )}
      </div>
    </div>
  );
}
