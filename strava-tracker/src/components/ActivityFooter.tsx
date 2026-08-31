"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Avatar from "./Avatar";
import { KUDOS_GLYPH } from "@/lib/constants";
import type { PublicActivity, PublicComment } from "@/lib/serialize";

const MAX_COMMENT_LENGTH = 2000;

function formatCommentLabel(commentCount: number): string {
  if (commentCount === 0) return "Comment";
  if (commentCount === 1) return "1 Comment";
  return `${commentCount} Comments`;
}

export default function ActivityFooter({ activity }: { activity: PublicActivity }) {
  const { data: session } = useSession();
  const router = useRouter();
  const currentUserId = session?.user?.id;

  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<PublicComment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const [newBody, setNewBody] = useState("");
  const [submittingNew, setSubmittingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function fetchComments() {
    setLoadingComments(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/activities/${activity.id}/comments`);
      if (!res.ok) throw new Error("Failed to load comments");
      const data = await res.json();
      setComments(data);
    } catch (err) {
      setCommentsError((err as Error).message);
    } finally {
      setLoadingComments(false);
    }
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && comments === null) {
      fetchComments();
    }
  }

  async function toggleReaction(reactedByMe: boolean) {
    if (!currentUserId) return;
    const res = await fetch(`/api/activities/${activity.id}/reactions`, {
      method: reactedByMe ? "DELETE" : "POST",
    });
    if (res.ok) {
      router.refresh();
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newBody.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return;
    setSubmittingNew(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        setNewBody("");
        await fetchComments();
        router.refresh();
      }
    } finally {
      setSubmittingNew(false);
    }
  }

  function startEdit(comment: PublicComment) {
    setConfirmingDeleteId(null);
    setEditingId(comment.id);
    setEditBody(comment.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }

  async function submitEdit(id: string) {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditBody("");
        await fetchComments();
        router.refresh();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      return;
    }
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchComments();
        router.refresh();
      }
    } finally {
      setConfirmingDeleteId(null);
    }
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={currentUserId ? () => toggleReaction(activity.reactedByMe) : undefined}
          className={
            activity.reactedByMe
              ? "flex items-center gap-1 rounded-full border border-accent-positive bg-accent-positive/15 px-2.5 py-1 font-mono text-xs text-accent-positive"
              : `flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 font-mono text-xs text-text-secondary ${
                  currentUserId ? "cursor-pointer transition hover:border-accent-positive hover:text-accent-positive" : "cursor-default"
                }`
          }
        >
          <span>{KUDOS_GLYPH}</span>
          {activity.reactionCount > 0 && <span>{activity.reactionCount}</span>}
        </button>

        <button
          type="button"
          onClick={toggleExpanded}
          className="ml-auto rounded-full border border-border-strong px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-text-secondary transition hover:border-accent-positive hover:text-accent-positive"
        >
          {formatCommentLabel(activity.commentCount)}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {loadingComments && <p className="font-body text-xs text-text-tertiary">Loading comments...</p>}
          {commentsError && <p className="font-body text-xs text-accent-alert">{commentsError}</p>}
          {!loadingComments && comments && comments.length === 0 && (
            <p className="font-body text-xs text-text-tertiary">No comments yet.</p>
          )}

          {comments && comments.length > 0 && (
            <ul className="flex flex-col gap-3">
              {comments.map((comment) => {
                const isOwner = currentUserId === comment.userId;
                const isEditing = editingId === comment.id;

                return (
                  <li key={comment.id} className="flex items-start gap-2">
                    <Avatar
                      id={comment.user.id}
                      firstName={comment.user.firstName}
                      lastName={comment.user.lastName}
                      photoUrl={comment.user.profilePhotoUrl}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-body text-xs font-medium text-text-primary">
                        {comment.user.firstName} {comment.user.lastName}
                      </span>

                      {isEditing ? (
                        <div className="mt-1 flex flex-col gap-2">
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            maxLength={MAX_COMMENT_LENGTH}
                            rows={2}
                            className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 font-body text-xs text-text-primary outline-none focus:border-accent-positive"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => submitEdit(comment.id)}
                              disabled={savingEdit || !editBody.trim()}
                              className="rounded-full bg-accent-positive px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-bg transition hover:opacity-90 disabled:opacity-50"
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-full border border-border-strong px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-secondary hover:text-text-primary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap break-words font-body text-sm text-text-secondary">
                          {comment.body}
                        </p>
                      )}

                      {isOwner && !isEditing && (
                        <div className="mt-1 flex gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(comment)}
                            className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary transition hover:text-accent-positive"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(comment.id)}
                            className={
                              confirmingDeleteId === comment.id
                                ? "font-mono text-[10px] uppercase tracking-widest text-accent-alert"
                                : "font-mono text-[10px] uppercase tracking-widest text-text-tertiary transition hover:text-accent-alert"
                            }
                          >
                            {confirmingDeleteId === comment.id ? "Confirm Delete" : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {currentUserId && (
            <form onSubmit={handleAddComment} className="flex flex-col gap-2">
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                maxLength={MAX_COMMENT_LENGTH}
                rows={2}
                placeholder="Add a comment..."
                className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 font-body text-xs text-text-primary outline-none focus:border-accent-positive"
              />
              <button
                type="submit"
                disabled={submittingNew || !newBody.trim()}
                className="self-end rounded-full bg-accent-positive px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {submittingNew ? "Posting..." : "Post"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
