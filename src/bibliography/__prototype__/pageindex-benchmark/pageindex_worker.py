#!/usr/bin/env python3
"""PROTOTYPE JETABLE — PageIndex local, jamais PageIndex Cloud."""
from __future__ import annotations
import hashlib, json, os, re, sys, time
from pathlib import Path

def fp(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""): digest.update(block)
    return digest.hexdigest()

def norm(text):
    return re.sub(r"\s+", " ", re.sub(r"-\s*\n\s*", "", text.replace("\u00ad", ""))).strip().lower()

def pages(spec):
    out = []
    for part in str(spec).split(","):
        match = re.fullmatch(r"\s*(\d+)(?:\s*-\s*(\d+))?\s*", part)
        if match: out.extend(range(int(match.group(1)), int(match.group(2) or match.group(1)) + 1))
    return sorted(set(out))

def documents(payload):
    wanted = set(payload["case"]["sourceIds"])
    selected = [dict(item) for item in payload["manifest"]["documents"] if item["sourceId"] in wanted]
    missing = wanted - {item["sourceId"] for item in selected}
    if missing: raise ValueError("Sources absentes du manifeste: " + ", ".join(sorted(missing)))
    for item in selected:
        item["path"] = str(Path(item["path"]).expanduser().resolve())
        if not Path(item["path"]).is_file(): raise FileNotFoundError(item["path"])
        if Path(item["path"]).suffix.lower() != ".pdf": raise ValueError("PageIndex local exige un PDF")
    return selected

def result(payload, engine, items, started, errors=None):
    return {"caseId": payload["case"]["id"], "engine": engine, "items": items,
            "diagnostics": {"durationMs": round((time.perf_counter() - started) * 1000), "errors": errors or []}}

def prefix(payload, docs):
    from PyPDF2 import PdfReader
    started, items = time.perf_counter(), []
    for doc in docs:
        text, last = "", 0
        for last, page in enumerate(PdfReader(doc["path"]).pages, 1):
            text += page.extract_text() or ""
            if len(text) >= 2000: break
        for probe in payload["case"]["probes"]:
            items.append({"id": f"prefix:{probe['id']}:{doc['sourceId']}", "kind": "passage",
              "probeId": probe["id"], "sourceId": doc["sourceId"], "pageRange": f"1-{last}",
              "text": text[:2000], "reason": probe["reason"], "sourceFingerprint": fp(Path(doc["path"])),
              "provenance": "verified_exact"})
    return result(payload, "prefix", items, started)

def parse_answer(answer):
    answer = str(answer)
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", answer, re.S)
    candidate = fenced.group(1) if fenced else answer[answer.find("{"):answer.rfind("}") + 1]
    return json.loads(candidate)

def pageindex(payload, docs):
    from pageindex import PageIndexLocalClient
    index_model = os.environ.get("AUTO_ESSAY_PAGEINDEX_INDEX_MODEL")
    chat_model = os.environ.get("AUTO_ESSAY_PAGEINDEX_CHAT_MODEL")
    if not index_model or not chat_model:
        raise RuntimeError("Définir explicitement AUTO_ESSAY_PAGEINDEX_INDEX_MODEL et AUTO_ESSAY_PAGEINDEX_CHAT_MODEL")
    started = time.perf_counter()
    client = PageIndexLocalClient(index_model=index_model, chat_model=chat_model, storage_path=payload["storagePath"])
    existing = client.list_documents(limit=100).get("documents", [])
    cached = {d.get("metadata", {}).get("sourceId"): d for d in existing if isinstance(d.get("metadata"), dict)}
    indexed = {}
    for doc in docs:
        fingerprint = fp(Path(doc["path"]))
        old = cached.get(doc["sourceId"])
        if old and old.get("metadata", {}).get("sourceFingerprint") == fingerprint:
            indexed[doc["sourceId"]] = {"id": old["id"], "name": old["name"]}
        else:
            new = client.submit_document(doc["path"], metadata={"sourceId": doc["sourceId"], "sourceFingerprint": fingerprint})
            indexed[doc["sourceId"]] = {"id": new["doc_id"], "name": new["name"]}
    mapping = {key: value["name"] for key, value in indexed.items()}
    items, errors = [], []
    for probe in payload["case"]["probes"]:
        prompt = {"subject": payload["case"]["subject"], "hypothesis": payload["case"].get("hypothesis"),
          "reason": probe["reason"], "query": probe["query"], "documentMapping": mapping,
          "instruction": "Retourne seulement JSON: {results:[{sourceId,pageRange,sectionPath,excerpt}]}. excerpt doit être verbatim."}
        try:
            answer = client.chat([{"role": "system", "content": "Localise seulement des passages. Aucun claim, thèse ou décision."},
                                  {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}],
                                 doc_id=[value["id"] for value in indexed.values()])
            for number, raw in enumerate(parse_answer(answer).get("results", [])):
                source_id, spec, excerpt = raw.get("sourceId"), str(raw.get("pageRange", "")), raw.get("excerpt", "")
                source = indexed.get(source_id)
                text = "\n".join(p.get("markdown", "") for p in client.get_page_content(source["id"], ",".join(map(str, pages(spec))))) if source and pages(spec) else ""
                provenance = "verified_exact" if excerpt in text else "verified_normalized" if norm(excerpt) in norm(text) else "rejected"
                path = next((Path(d["path"]) for d in docs if d["sourceId"] == source_id), None)
                items.append({"id": f"pageindex:{probe['id']}:{number}", "kind": "passage", "probeId": probe["id"],
                  "sourceId": source_id, "pageRange": spec, "text": excerpt, "reason": probe["reason"],
                  "sourceFingerprint": fp(path) if path else None, "provenance": provenance})
        except Exception as error: errors.append(f"{probe['id']}: {error}")
    return result(payload, "pageindex", items, started, errors)

def main():
    payload = json.load(sys.stdin); docs = documents(payload)
    json.dump(prefix(payload, docs) if payload["engine"] == "prefix" else pageindex(payload, docs), sys.stdout, ensure_ascii=False)

if __name__ == "__main__":
    try: main()
    except Exception as error: print(str(error), file=sys.stderr); raise SystemExit(1)
