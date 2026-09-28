import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import type { DraftUnit, Source } from "@auto-essay/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSources } from "@/hooks/useSources";
import { useUnits } from "@/hooks/useUnits";
import {
  useSourceOverview,
  sourceStateLabels,
} from "@/hooks/useSourceOverview";
import {
  setScopeContextSourceIncluded,
  type ScopeContextSource,
} from "@/api/scopeContext";
import {
  ProjectWorkspace,
  scopeFromQuery,
} from "@/components/workspace/ProjectWorkspace";
import { workspaceStyles as s } from "@/components/workspace/workspaceStyles";
import { themeVars as t } from "../styles/tokens.stylex";

type Filter = "all" | ScopeContextSource["state"];
const filters: Array<[Filter, string]> = [
  ["all", "Toutes"],
  ["explored", "Explorées"],
  ["partial", "Partielles"],
  ["registered_unexplored", "Non explorées"],
  ["unusable", "Non exploitables"],
];

export function SourcesPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [query, setQuery] = useSearchParams();
  const { sources, loading, error, importFiles, update, remove } =
    useSources(projectId);
  const { units, reload: reloadUnits } = useUnits(projectId);
  const [revision, setRevision] = useState(0);
  const overview = useSourceOverview(projectId, revision);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const filtered = sources.filter(
    (source) =>
      (filter === "all" ||
        overview.sources.find((item) => item.id === source.id)?.state ===
          filter) &&
      `${source.title} ${source.authors.join(" ")} ${source.tags.join(" ")}`
        .toLocaleLowerCase("fr")
        .includes(search.toLocaleLowerCase("fr")),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 8) - 1),
  );
  const visible = filtered.slice(currentPage * 8, currentPage * 8 + 8);
  const selected =
    filtered.find((source) => source.id === query.get("sourceId")) ??
    visible[0];
  const manuscriptScope = scopeFromQuery(query);

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true);
    setFailure(undefined);
    setNotice(undefined);
    try {
      const supported = Array.from(files).filter((file) =>
        /\.(md|bib)$/i.test(file.name),
      );
      const unsupported = files.length - supported.length;
      if (!supported.length)
        throw new Error(
          "Importez des fichiers Markdown (.md) ou BibTeX (.bib).",
        );
      const result = await importFiles(
        await Promise.all(
          supported.map(async (file) => ({
            name: file.name.replace(/\.(md|bib)$/i, (extension) =>
              extension.toLowerCase(),
            ),
            content: await file.text(),
          })),
        ),
      );
      setNotice(
        `${result?.imported ?? 0} source(s) importée(s).${unsupported ? ` ${unsupported} fichier(s) au format non pris en charge.` : ""}`,
      );
      if (result?.errors.length)
        setFailure(
          result.errors
            .map((item) => `${item.file} : ${item.message}`)
            .join(" · "),
        );
      setRevision((value) => value + 1);
    } catch (reason) {
      setFailure(
        reason instanceof Error ? reason.message : "Import impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProjectWorkspace
      projectId={projectId}
      scope={selected ? { kind: "source", id: selected.id } : manuscriptScope}
      revision={revision}
    >
      <div {...stylex.props(s.row)}>
        <h1 {...stylex.props(s.title)}>Bibliographie et sources</h1>
        <label {...stylex.props(styles.import)}>
          {busy ? "Import en cours…" : "＋ Importer des sources"}
          <input
            aria-label="Importer des sources"
            type="file"
            accept=".md,.bib"
            multiple
            disabled={busy}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
            {...stylex.props(styles.fileInput)}
          />
        </label>
      </div>
      <p {...stylex.props(s.subtitle)}>
        Explorez vos documents et reliez les passages utiles à votre manuscrit.
        Import Markdown et BibTeX.
      </p>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <div {...stylex.props(s.tabs)} aria-label="Filtrer les sources">
          {filters.map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={filter === id}
              {...stylex.props(s.tab, filter === id && s.tabActive)}
              onClick={() => {
                setFilter(id);
                setPage(0);
              }}
            >
              {label} (
              {id === "all"
                ? sources.length
                : overview.sources.filter((source) => source.state === id)
                    .length}
              )
            </button>
          ))}
        </div>
        <Input
          aria-label="Rechercher une source"
          placeholder="Rechercher un titre, un auteur, un mot-clé…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        {loading && <p role="status">Chargement des sources…</p>}
        {(error || failure) && (
          <p role="alert" {...stylex.props(s.error)}>
            {error?.message ?? failure}
          </p>
        )}
        {overview.error && (
          <p role="status" {...stylex.props(s.meta)}>
            {overview.error}
          </p>
        )}
        {notice && (
          <p role="status" {...stylex.props(s.meta)}>
            {notice}
          </p>
        )}
        {!loading && !sources.length && (
          <p {...stylex.props(s.subtitle)}>
            Votre bibliothèque est vide. Importez vos premières sources pour
            commencer.
          </p>
        )}
        {!loading && sources.length > 0 && !filtered.length && (
          <p>Aucune source ne correspond à ces filtres.</p>
        )}
        <div {...stylex.props(styles.library)}>
          <section
            aria-label="Liste des sources"
            {...stylex.props(styles.list)}
          >
            {visible.map((source) => {
              const state = overview.sources.find(
                (item) => item.id === source.id,
              )?.state;
              return (
                <button
                  type="button"
                  key={source.id}
                  aria-pressed={selected?.id === source.id}
                  {...stylex.props(
                    styles.sourceButton,
                    selected?.id === source.id && s.active,
                  )}
                  onClick={() =>
                    setQuery(
                      (current) => {
                        const next = new URLSearchParams(current);
                        next.set("sourceId", source.id);
                        return next;
                      },
                      { replace: true },
                    )
                  }
                >
                  <strong>{source.authors.join(", ") || source.title}</strong>
                  <span>{source.title}</span>
                  <span {...stylex.props(s.badge)}>
                    {state ? sourceStateLabels[state] : "État indisponible"}
                  </span>
                </button>
              );
            })}
            {filtered.length > 8 && (
              <div {...stylex.props(s.row)}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Précédent
                </Button>
                <span {...stylex.props(s.meta)}>
                  {currentPage + 1} / {Math.ceil(filtered.length / 8)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={(currentPage + 1) * 8 >= filtered.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Suivant
                </Button>
              </div>
            )}
          </section>
          {selected && (
            <SourceDetail
              key={selected.id}
              source={selected}
              profile={overview.sources.find((item) => item.id === selected.id)}
              units={units}
              onUpdate={(patch) => update(selected.id, patch)}
              onDelete={async () => {
                await remove(selected.id);
                setQuery(
                  (current) => {
                    const next = new URLSearchParams(current);
                    next.delete("sourceId");
                    return next;
                  },
                  { replace: true },
                );
                setRevision((value) => value + 1);
              }}
              onLink={
                manuscriptScope && manuscriptScope.kind !== "source"
                  ? async () => {
                      await setScopeContextSourceIncluded(
                        projectId,
                        manuscriptScope,
                        selected.id,
                        true,
                      );
                      await reloadUnits();
                      setRevision((value) => value + 1);
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </ProjectWorkspace>
  );
}

function SourceDetail({
  source,
  profile,
  units,
  onUpdate,
  onDelete,
  onLink,
}: {
  source: Source;
  profile?: ScopeContextSource;
  units: DraftUnit[];
  onUpdate: (patch: Partial<Omit<Source, "id">>) => Promise<Source | undefined>;
  onDelete: () => Promise<void>;
  onLink?: () => Promise<void>;
}) {
  const [tab, setTab] = useState("Aperçu");
  const [limits, setLimits] = useState(source.epistemicLimits.join("\n"));
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const linked = units.filter((unit) =>
    unit.evidencePack.sourceIds.includes(source.id),
  );
  const passages = units.flatMap((unit) =>
    unit.evidencePack.keyCitations
      .filter((citation) => citation.sourceId === source.id)
      .map((citation) => ({ ...citation, unitId: unit.id })),
  );
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await action();
      setMessage(success);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section {...stylex.props(styles.detail)} aria-label="Détail de la source">
      <h2 {...stylex.props(s.label)}>{source.title}</h2>
      <p {...stylex.props(s.meta)}>
        {source.authors.join(", ")}
        {source.publicationDate ? ` · ${source.publicationDate}` : ""}
        {source.publisher ? ` · ${source.publisher}` : ""}
      </p>
      <div {...stylex.props(s.tabs)} aria-label="Détail documentaire">
        {["Aperçu", "Passages", "Notes", "Liens", "Contenu"].map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={tab === name}
            {...stylex.props(s.tab, tab === name && s.tabActive)}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "Aperçu" && (
        <div {...stylex.props(s.stack)}>
          <div>
            <h3 {...stylex.props(s.label)}>Résumé</h3>
            <p {...stylex.props(s.meta)}>
              {profile?.abstract ||
                "Aucun résumé disponible. Consultez le contenu de la source."}
            </p>
          </div>
          <div {...stylex.props(s.row)}>
            <span {...stylex.props(s.meta)}>Type : {source.type}</span>
            {profile?.coverage && (
              <span {...stylex.props(s.meta)}>
                {profile.coverage.coveredBlocks} /{" "}
                {profile.coverage.totalBlocks} blocs explorés
              </span>
            )}
          </div>
          <div>
            {source.tags.map((tag) => (
              <span key={tag} {...stylex.props(s.badge)}>
                {tag}{" "}
              </span>
            ))}
          </div>
          <label {...stylex.props(s.meta)}>
            Limites épistémiques
            <Textarea
              aria-label="Limites épistémiques"
              value={limits}
              onChange={(event) => setLimits(event.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || limits === source.epistemicLimits.join("\n")}
            onClick={() =>
              void run(
                () =>
                  onUpdate({
                    epistemicLimits: limits
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  }),
                "Limites enregistrées.",
              )
            }
          >
            Enregistrer les limites
          </Button>
        </div>
      )}
      {tab === "Passages" && (
        <>
          {passages.length ? (
            passages.map((passage, index) => (
              <blockquote key={index} {...stylex.props(s.passage)}>
                {passage.quote}
                <footer {...stylex.props(s.meta)}>
                  {passage.pageRange || "Repère de page non renseigné"} ·{" "}
                  <Link
                    {...stylex.props(s.link)}
                    to={`/projects/${source.projectId}/editor?unitId=${encodeURIComponent(passage.unitId)}`}
                  >
                    Voir dans le manuscrit
                  </Link>
                </footer>
              </blockquote>
            ))
          ) : (
            <p {...stylex.props(s.meta)}>
              Aucun passage de cette source n’est encore mobilisé dans le
              manuscrit.
            </p>
          )}
        </>
      )}
      {tab === "Notes" && (
        <div {...stylex.props(s.stack)}>
          {source.annotations.map((annotation) => (
            <article key={annotation.id} {...stylex.props(s.card)}>
              {annotation.content}
              {annotation.note && <p>{annotation.note}</p>}
            </article>
          ))}
          <Textarea
            aria-label="Nouvelle note"
            placeholder="Votre note sur cette source…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            disabled={busy || !note.trim()}
            onClick={() =>
              void run(async () => {
                await onUpdate({
                  annotations: [
                    ...source.annotations,
                    {
                      id: crypto.randomUUID(),
                      sourceId: source.id,
                      content: note.trim(),
                      tags: [],
                      createdAt: new Date().toISOString(),
                    },
                  ],
                });
                setNote("");
              }, "Note enregistrée.")
            }
          >
            Ajouter une note
          </Button>
        </div>
      )}
      {tab === "Liens" && (
        <div {...stylex.props(s.stack)}>
          {(profile?.nodeLinks ?? []).map((node) => (
            <Link
              key={node.id}
              {...stylex.props(s.link)}
              to={`/projects/${source.projectId}/chapitre?chapterId=${encodeURIComponent(node.id)}`}
            >
              {node.title} · Cadrage
            </Link>
          ))}
          {linked.length ? (
            linked.map((unit) => (
              <Link
                key={unit.id}
                {...stylex.props(s.link)}
                to={`/projects/${source.projectId}/editor?unitId=${encodeURIComponent(unit.id)}`}
              >
                {unit.thesis || unit.contextInPlan?.section || "Passage"}
              </Link>
            ))
          ) : (
            <p {...stylex.props(s.meta)}>
              Aucun passage rédigé ne référence encore cette source.
            </p>
          )}
          {onLink ? (
            <Button
              disabled={busy}
              onClick={() =>
                void run(onLink, "Source liée à la sélection du manuscrit.")
              }
            >
              Lier à la sélection du manuscrit
            </Button>
          ) : (
            <p {...stylex.props(s.meta)}>
              Choisissez un chapitre ou un passage dans la navigation pour y
              rattacher cette source.
            </p>
          )}
        </div>
      )}
      {tab === "Contenu" && (
        <>
          <p {...stylex.props(styles.content)}>
            {source.content ||
              "Notice bibliographique seule : aucun texte importé."}
          </p>
          {source.url && /^https?:\/\//i.test(source.url) && (
            <a
              {...stylex.props(s.link)}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir le document original ↗
            </a>
          )}
        </>
      )}
      {error && (
        <p role="alert" {...stylex.props(s.error)}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" {...stylex.props(s.meta)}>
          {message}
        </p>
      )}
      <details {...stylex.props(styles.manage)}>
        <summary>Gérer la source</summary>
        {confirmDelete ? (
          <>
            <p {...stylex.props(s.meta)}>
              Supprimer cette source de la bibliothèque ?
            </p>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => void run(onDelete, "Source supprimée.")}
            >
              Confirmer la suppression
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Annuler
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            Supprimer la source
          </Button>
        )}
      </details>
    </section>
  );
}
const styles = stylex.create({
  library: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(11rem, 0.85fr) minmax(0, 1.4fr)",
      "@media (max-width: 45rem)": "1fr",
    },
    marginTop: "1rem",
    gap: "1rem",
  },
  list: {
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: t.border,
    paddingRight: "0.6rem",
  },
  sourceButton: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    textAlign: "left",
    padding: "0.9rem 0.7rem",
    fontSize: "0.8rem",
    color: t.textSecondary,
    borderWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: t.border,
    backgroundColor: "transparent",
    width: "100%",
    borderRadius: t.radiusSmall,
    cursor: "pointer",
  },
  detail: { minWidth: 0, padding: "1rem 0.3rem" },
  import: {
    position: "relative",
    color: t.accent,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: t.border,
    borderRadius: t.radiusSmall,
    padding: "0.7rem",
    fontSize: "0.8rem",
    cursor: "pointer",
    outline: { ":focus-within": `2px solid ${t.focus}` },
  },
  fileInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    width: "100%",
    cursor: "pointer",
  },
  content: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontFamily: t.fontManuscript,
    fontSize: "1rem",
    lineHeight: 1.7,
  },
  manage: { marginTop: "2rem", fontSize: "0.8rem", color: t.textSecondary },
});
