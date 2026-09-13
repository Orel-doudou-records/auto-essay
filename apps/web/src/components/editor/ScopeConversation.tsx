import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  fetchScopeConversation,
  sendScopeConversationMessage,
  type ScopeConversationMessage,
  type ScopeConversationRef,
} from "@/api/scopeConversation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { themeVars } from "../../styles/tokens.stylex";

export function ScopeConversation({
  projectId,
  scope,
}: {
  projectId: string;
  scope: ScopeConversationRef;
}) {
  const [messages, setMessages] = useState<ScopeConversationMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    setMessages([]);
    void fetchScopeConversation(projectId, scope)
      .then((next) => {
        if (active) setMessages(next);
      })
      .catch(() => {
        if (active) setError("La conversation de ce scope n’a pas pu être chargée.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, scope.kind, scope.id]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setError(undefined);
    try {
      const next = await sendScopeConversationMessage(projectId, scope, content);
      setMessages(next);
      setMessage("");
    } catch {
      setError("AutoEssay n’a pas pu répondre. Votre manuscrit n’a pas été modifié.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Conversation du scope" {...stylex.props(styles.root)}>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Conversation située</p>
        <p {...stylex.props(styles.help)}>
          Ce fil aide à réfléchir ici. Les décisions et modifications restent dans leurs outils dédiés.
        </p>
      </header>
      {loading ? (
        <p {...stylex.props(styles.status)}>Chargement de la conversation…</p>
      ) : messages.length > 0 ? (
        <ol {...stylex.props(styles.messages)} aria-label="Échanges du scope">
          {messages.map((entry) => (
            <li key={entry.id} {...stylex.props(styles.message)}>
              <strong {...stylex.props(styles.role)}>{entry.role === "author" ? "Vous" : "AutoEssay"}</strong>
              <p {...stylex.props(styles.content)}>{entry.content}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p {...stylex.props(styles.status)}>Aucun échange dans ce scope.</p>
      )}
      <form onSubmit={(event) => void submit(event)} {...stylex.props(styles.form)}>
        <Textarea
          aria-label="Message à AutoEssay pour ce scope"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Discuter de ce passage…"
          rows={3}
        />
        <Button type="submit" size="sm" disabled={!message.trim() || sending} fullWidth>
          {sending ? "Réponse…" : "Envoyer"}
        </Button>
      </form>
      {error && <p role="alert" {...stylex.props(styles.error)}>{error}</p>}
    </section>
  );
}

const styles = stylex.create({
  root: {
    borderBottomColor: themeVars.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    paddingBottom: "1.25rem",
  },
  eyebrow: {
    color: themeVars.textSubtle,
    fontSize: "0.72rem",
    fontWeight: 650,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  help: { color: themeVars.textSecondary, fontSize: "0.82rem", lineHeight: 1.5, margin: "0.35rem 0 0" },
  status: { color: themeVars.textSubtle, fontSize: "0.82rem", margin: 0 },
  messages: { display: "flex", flexDirection: "column", gap: "0.75rem", listStyle: "none", margin: 0, padding: 0 },
  message: { margin: 0 },
  role: { color: themeVars.textPrimary, fontSize: "0.75rem" },
  content: { color: themeVars.textSecondary, fontSize: "0.875rem", lineHeight: 1.55, margin: "0.2rem 0 0", whiteSpace: "pre-wrap" },
  form: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  error: { color: themeVars.danger, fontSize: "0.82rem", margin: 0 },
});
