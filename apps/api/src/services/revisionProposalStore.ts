import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { RevisionProposalSchema, type RevisionProposal } from "@auto-essay/core";
import { getDataDir } from "../config.js";

const ProposalsSchema = z.object({ proposals: z.array(RevisionProposalSchema) });

export async function createRevisionProposal(
  projectId: string,
  unitId: string,
  sourceVersion: number,
  before: string,
  content: string
): Promise<RevisionProposal> {
  const proposal = RevisionProposalSchema.parse({
    id: crypto.randomUUID(), projectId, unitId, sourceVersion, before, content,
    status: "available", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const data = await readProposals(projectId);
  data.proposals.push(proposal);
  await writeProposals(projectId, data);
  return proposal;
}

export async function getRevisionProposal(projectId: string, proposalId: string) {
  return (await readProposals(projectId)).proposals.find((proposal) => proposal.id === proposalId);
}

export async function updateRevisionProposal(projectId: string, proposal: RevisionProposal): Promise<RevisionProposal> {
  const data = await readProposals(projectId);
  data.proposals = data.proposals.map((current) => current.id === proposal.id ? proposal : current);
  await writeProposals(projectId, data);
  return proposal;
}

async function readProposals(projectId: string): Promise<z.infer<typeof ProposalsSchema>> {
  try { return ProposalsSchema.parse(JSON.parse(await fs.readFile(proposalsPath(projectId), "utf-8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { proposals: [] }; throw error; }
}

async function writeProposals(projectId: string, data: z.infer<typeof ProposalsSchema>) {
  const dir = path.join(getDataDir(), projectId);
  await fs.mkdir(dir, { recursive: true });
  const target = proposalsPath(projectId);
  await fs.writeFile(`${target}.tmp`, JSON.stringify(data, null, 2));
  await fs.rename(`${target}.tmp`, target);
}

function proposalsPath(projectId: string) { return path.join(getDataDir(), projectId, "revision-proposals.json"); }
