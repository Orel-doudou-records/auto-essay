import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getDataDir } from "../config.js";
import { withProjectWriteLock } from "./projectWriteLock.js";

export const ScopeConversationScopeSchema = z.object({
  kind: z.enum(["node", "unit"]),
  id: z.string().min(1),
});

export type ScopeConversationScope = z.infer<typeof ScopeConversationScopeSchema>;

export const ScopeConversationMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["author", "autoessay"]),
  content: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type ScopeConversationMessage = z.infer<typeof ScopeConversationMessageSchema>;

const ScopeConversationFileSchema = z.object({
  scopes: z.array(z.object({
    scope: ScopeConversationScopeSchema,
    messages: z.array(ScopeConversationMessageSchema),
  })),
});

type ScopeConversationFile = z.infer<typeof ScopeConversationFileSchema>;

export async function readScopeConversation(
  projectId: string,
  scope: ScopeConversationScope
): Promise<ScopeConversationMessage[]> {
  const data = await readConversationFile(projectId);
  return data.scopes.find((entry) => sameScope(entry.scope, scope))?.messages ?? [];
}

export async function appendScopeConversationExchange(
  projectId: string,
  scope: ScopeConversationScope,
  authorContent: string,
  autoessayContent: string
): Promise<ScopeConversationMessage[]> {
  return withProjectWriteLock(projectId, async () => {
    const data = await readConversationFile(projectId);
    let entry = data.scopes.find((candidate) => sameScope(candidate.scope, scope));
    if (!entry) {
      entry = { scope: ScopeConversationScopeSchema.parse(scope), messages: [] };
      data.scopes.push(entry);
    }

    const authorMessage = ScopeConversationMessageSchema.parse({
      id: crypto.randomUUID(),
      role: "author",
      content: authorContent,
      createdAt: new Date().toISOString(),
    });
    const autoessayMessage = ScopeConversationMessageSchema.parse({
      id: crypto.randomUUID(),
      role: "autoessay",
      content: autoessayContent,
      createdAt: new Date().toISOString(),
    });
    entry.messages.push(authorMessage, autoessayMessage);
    await writeConversationFile(projectId, data);
    return entry.messages;
  });
}

function sameScope(left: ScopeConversationScope, right: ScopeConversationScope): boolean {
  return left.kind === right.kind && left.id === right.id;
}

async function readConversationFile(projectId: string): Promise<ScopeConversationFile> {
  try {
    const raw = await fs.readFile(conversationPath(projectId), "utf-8");
    return ScopeConversationFileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { scopes: [] };
    throw error;
  }
}

async function writeConversationFile(projectId: string, data: ScopeConversationFile): Promise<void> {
  const dir = path.join(getDataDir(), projectId);
  await fs.mkdir(dir, { recursive: true });
  const target = conversationPath(projectId);
  await fs.writeFile(`${target}.tmp`, JSON.stringify(ScopeConversationFileSchema.parse(data), null, 2));
  await fs.rename(`${target}.tmp`, target);
}

function conversationPath(projectId: string): string {
  return path.join(getDataDir(), projectId, "scope-conversation.json");
}
