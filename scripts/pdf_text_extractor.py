#!/usr/bin/env python3
"""Mechanical PDF text extraction for AutoEssay Corpus V2.

This worker has no PageIndex, OCR, semantic-structure, or layout responsibilities.
It emits page text plus extraction diagnostics only.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as error:  # infrastructure failure, not document unreadability
    print(
        "pypdf is required for PDF ingestion; install requirements-pdf.txt",
        file=sys.stderr,
    )
    raise SystemExit(2) from error


def unreadable(error: Exception) -> dict[str, object]:
    return {
        "pageCount": 0,
        "pages": [],
        "diagnostics": [f"PDF parse failed: {type(error).__name__}: {error}"],
        "fatal": True,
    }


def extract(path: Path) -> dict[str, object]:
    diagnostics: list[str] = []
    try:
        reader = PdfReader(str(path), strict=False)
        page_count = len(reader.pages)
    except Exception as error:  # corrupt/encrypted/otherwise unreadable document
        return unreadable(error)

    pages: list[dict[str, object]] = []
    for index in range(page_count):
        number = index + 1
        try:
            page = reader.pages[index]
            text = page.extract_text() or ""
        except Exception as error:
            text = ""
            diagnostics.append(
                f"Page {number} text extraction failed: {type(error).__name__}: {error}"
            )
        pages.append({"number": number, "text": text})

    return {
        "pageCount": page_count,
        "pages": pages,
        "diagnostics": diagnostics,
        "fatal": False,
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: pdf_text_extractor.py <document.pdf>", file=sys.stderr)
        raise SystemExit(2)

    path = Path(sys.argv[1]).expanduser().resolve()
    if not path.is_file():
        print(f"PDF file not found: {path}", file=sys.stderr)
        raise SystemExit(2)

    json.dump(extract(path), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
