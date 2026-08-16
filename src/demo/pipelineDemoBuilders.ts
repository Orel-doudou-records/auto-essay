import { createClaim, type Claim } from "../domain/claim";
import type { ContentRelationParticipant } from "../domain/contentRelation";
import type { DraftUnit, EvidencePack } from "../domain/draftUnit";
import type { EditorialProjectionBundle } from "../domain/editorialProjection";
import { createSource, type Source } from "../domain/source";
import { createTransformationTrace, type TransformationTrace } from "../domain/transformationTrace";
import type {
  DemoParagraphDefinition,
  FullPipelineDemoDefinition,
} from "./pipelineDemoTypes";
import { required } from "./pipelineDemoUtils";

export function buildSources(definition: FullPipelineDemoDefinition): Source[] {
  return definition.sources.map((source) =>
    createSource({
      projectId: definition.projectId,
      title: source.title,
      content: source.content,
      type: source.type ?? "note",
      regime: source.regime,
      authors: source.authors ?? [],
      epistemicLimits: source.epistemicLimits ?? [],
      verificationStatus: source.verificationStatus ?? "verified",
      position: source.position,
    })
  );
}

export function buildClaims(
  definition: FullPipelineDemoDefinition,
  sourceByKey: Map<string, Source>
): Claim[] {
  const claimByKey = new Map<string, Claim>();

  return definition.claims.map((claim) => {
    const created = createClaim({
      projectId: definition.projectId,
      statement: claim.statement,
      sourceIds: claim.sourceKeys.map(
        (key) => required(sourceByKey.get(key), `Unknown source ${key}`).id
      ),
      confidenceLevel: claim.confidenceLevel,
      claimType: claim.claimType ?? "interpretation",
      contradictionOf: claim.contradictionOfKey
        ? required(
            claimByKey.get(claim.contradictionOfKey),
            `Contradicted claim ${claim.contradictionOfKey} must be declared first`
          ).id
        : undefined,
      status: "verified",
      scope: "section",
    });
    claimByKey.set(claim.key, created);
    return created;
  });
}

export function buildParticipantCatalog(
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): Map<ContentRelationParticipant["kind"], Map<string, string>> {
  return new Map([
    [
      "source",
      new Map([...sourceByKey.entries()].map(([key, source]) => [key, source.id])),
    ],
    [
      "claim",
      new Map([...claimByKey.entries()].map(([key, claim]) => [key, claim.id])),
    ],
    ["concept", new Map<string, string>()],
    ["tension", new Map<string, string>()],
    ["unit", new Map<string, string>()],
  ]);
}

export function buildEvidencePack(
  paragraph: DemoParagraphDefinition,
  sourceByKey: Map<string, Source>,
  claimByKey: Map<string, Claim>
): EvidencePack {
  return {
    sourceIds: paragraph.sourceKeys.map(
      (key) => required(sourceByKey.get(key), `Unknown source ${key}`).id
    ),
    keyCitations: [],
    supportingClaimIds: paragraph.claimKeys.map(
      (key) => required(claimByKey.get(key), `Unknown claim ${key}`).id
    ),
    objections: [],
    authorNotes: paragraph.argumentativeFunction,
  };
}

export function buildSectionTraces(
  definition: FullPipelineDemoDefinition,
  generation: { section: DraftUnit },
  projections: EditorialProjectionBundle
): TransformationTrace[] {
  const traceDirective = required(
    projections.writer.directives.find(
      (directive) => directive.kind === "form" || directive.kind === "content"
    ),
    "The demonstration requires a traceable writer directive"
  );

  return definition.paragraphs.map((paragraph) =>
    createTransformationTrace(
      generation.section.id,
      generation.section.version,
      projections.writer,
      {
        directiveId: traceDirective.id,
        decisionId: traceDirective.decisionId,
        articulationId: traceDirective.articulationId,
        declaration: paragraph.traceDeclaration,
        excerpt: paragraph.traceExcerpt,
      }
    )
  );
}
