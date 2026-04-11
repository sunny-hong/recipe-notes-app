import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, useEditorState, ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";
import { validateImageFile, getResizeDimensions } from "@/utils/image";

/**
 * Tiptap node view that renders an image inside the editor with a drag-to-resize
 * handle in the bottom-right corner. When the image is selected, the yellow handle
 * appears; dragging it horizontally updates the stored `width` attribute so the
 * size persists when the document is saved and reloaded.
 */
function ResizableImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { src, alt, title, width } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
  };

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = containerRef.current?.offsetWidth ?? 400;

    function onMouseMove(e: MouseEvent) {
      const newWidth = Math.max(80, startWidth + (e.clientX - startX));
      updateAttributes({ width: newWidth });
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        style={{
          display: "inline-block",
          position: "relative",
          width: width ? `${width}px` : "100%",
          maxWidth: "100%",
        }}
      >
        <img
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          style={{ display: "block", width: "100%", height: "auto" }}
          draggable={false}
        />
        {selected && (
          <div
            onMouseDown={startResize}
            title="Drag to resize"
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              width: 14,
              height: 14,
              background: "#F5C518",
              border: "2px solid white",
              borderRadius: 3,
              cursor: "se-resize",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              zIndex: 10,
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.style.width || el.getAttribute("width");
          if (!w) return null;
          return parseInt(w, 10) || null;
        },
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { style: `width: ${attrs.width}px; max-width: 100%` };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});

/**
 * A single icon button in the formatting toolbar. Uses `onMouseDown` instead of
 * `onClick` so the editor doesn't lose focus before the formatting command runs.
 * Highlights with a yellow background when the cursor is inside the matching
 * format (e.g. bold text), indicated by the `active` prop.
 */
type ToolbarButtonProps = {
  active: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ active, onMouseDown, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      title={title}
      className="w-7 h-7 flex items-center justify-center transition-colors"
      style={{
        background: active ? "#F5C518" : "transparent",
        color: active ? "#1a1a1a" : "#6b6259",
        border: "none",
        borderRadius: 4,
      }}
    >
      {children}
    </button>
  );
}

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

/**
 * Full-page editor for a single recipe. Renders a title input, a rich-text
 * toolbar, and a Tiptap editor body. Changes are auto-saved to the server with
 * a 1200ms debounce — the save fires 1.2 seconds after the user stops typing.
 * The sidebar recipe list and the individual recipe cache are both kept in sync
 * after each successful save so navigating away and back shows fresh content.
 */
export default function RecipeEditor({ recipe, hasGoogleAccount }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(recipe.title);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<{ title?: string; content?: object }>({});
  const isSyncing = useRef(false);

  const updateMutation = useMutation(
    trpc.recipe.update.mutationOptions({
      onSuccess: (updatedRecipe) => {
        queryClient.invalidateQueries(trpc.recipe.list.queryOptions());
        // Keep the individual recipe cache current so switching back never
        // shows stale (empty) content while a background refetch runs.
        queryClient.setQueryData(
          trpc.recipe.get.queryOptions({ id: updatedRecipe.id }).queryKey,
          updatedRecipe,
        );
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Validates the chosen file, resizes it to fit within the max dimensions,
  // converts it to a JPEG data URL, and inserts it into the editor at the
  // current cursor position.
  function handleImageFile(file: File) {
    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const { width, height } = getResizeDimensions(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const src = canvas.toDataURL("image/jpeg", 0.85);
        editor?.chain().focus().setImage({ src }).run();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ResizableImage.configure({ inline: false }),
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

  const activeState = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      strike: e?.isActive("strike") ?? false,
      h1: e?.isActive("heading", { level: 1 }) ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      h3: e?.isActive("heading", { level: 3 }) ?? false,
      paragraph: e?.isActive("paragraph") ?? false,
      bulletList: e?.isActive("bulletList") ?? false,
      orderedList: e?.isActive("orderedList") ?? false,
    }),
  });

  // Reset editor when recipe changes
  useEffect(() => {
    if (editor && recipe.id) {
      editor.commands.setContent(recipe.content as object);
    }
    setTitle(recipe.title);
  }, [recipe.id]);

  function scheduleSave(partial: { title?: string; content?: object }) {
    pendingSave.current = { ...pendingSave.current, ...partial };
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const changes = pendingSave.current;
      pendingSave.current = {};
      updateMutation.mutate({
        id: recipe.id,
        ...changes,
        syncToDrive: false,
      });
    }, 1200);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    // Optimistically update the sidebar list so the title reflects immediately
    queryClient.setQueryData(
      trpc.recipe.list.queryOptions().queryKey,
      (old: { id: string; title: string; updatedAt: Date }[] | undefined) =>
        old?.map((r) => (r.id === recipe.id ? { ...r, title: val } : r)),
    );
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

      {/* Toolbar */}
      {editor && (
        <div className="px-10 py-1.5 border-b border-[var(--panel-border)] flex items-center gap-0.5 flex-wrap">
          <ToolbarButton
            active={activeState?.bold ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            title="Bold"
          >
            <span className="text-[13px] font-black leading-none">B</span>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.italic ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
            title="Italic"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.underline ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
            title="Underline"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.strike ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
            title="Strikethrough"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="4" y1="12" x2="20" y2="12"/><path d="M17.5 6.5C17.5 4.57 15.43 3 12 3c-3.31 0-5.5 1.57-5.5 4 0 1.5.9 2.7 2.5 3.5"/><path d="M6.5 17.5C6.5 19.43 8.57 21 12 21c3.31 0 5.5-1.57 5.5-4 0-1.3-.7-2.4-2-3.1"/></svg>
          </ToolbarButton>

          <div className="w-px h-4 bg-[#e0d9d0] mx-1" />

          <ToolbarButton
            active={activeState?.h1 ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
            title="Heading 1"
          >
            <span className="text-[11px] font-bold leading-none">H1</span>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.h2 ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
            title="Heading 2"
          >
            <span className="text-[11px] font-bold leading-none">H2</span>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.h3 ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
            title="Heading 3"
          >
            <span className="text-[11px] font-bold leading-none">H3</span>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.paragraph ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setParagraph().run(); }}
            title="Paragraph"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 4a5 5 0 0 1 0 10H11v6H9V4h4zm0 8a3 3 0 0 0 0-6h-2v6h2z"/></svg>
          </ToolbarButton>

          <div className="w-px h-4 bg-[#e0d9d0] mx-1" />

          <ToolbarButton
            active={activeState?.bulletList ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
            title="Bullet List"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </ToolbarButton>
          <ToolbarButton
            active={activeState?.orderedList ?? false}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            title="Ordered List"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="1" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1.</text><text x="1" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2.</text><text x="1" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">3.</text></svg>
          </ToolbarButton>

          <div className="w-px h-4 bg-[#e0d9d0] mx-1" />

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = "";
            }}
          />
          <ToolbarButton
            active={false}
            onMouseDown={(e) => { e.preventDefault(); imageInputRef.current?.click(); }}
            title="Insert Image"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </ToolbarButton>
        </div>
      )}

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
