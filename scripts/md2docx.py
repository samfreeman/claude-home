#!/usr/bin/env python3
"""md2docx — minimal, dependency-free Markdown to Word (.docx) converter.

Uses only the Python standard library (no pandoc / python-docx needed).
Built for RSC2 / Claude deliverables so plain-readable memos can be handed
to non-technical readers in Word.

Supported Markdown subset:
  # Title              -> Title style (first level)
  ## / ### / ####      -> Heading 1 / 2 / 3
  paragraphs           -> body text
  **bold**  *italic*   -> inline formatting
  `code`               -> monospaced inline
  - bullet             -> bulleted paragraph
  ---                  -> horizontal rule
  [text](url)          -> rendered as text (url dropped)
  [^id] ... [^id]: def -> footnote refs become superscript numbers;
                          definitions are collected into a "Notes" section
                          at the end (endnote style — robust in Word).

Usage:
  python3 md2docx.py input.md [output.docx]
"""

import os
import re
import sys
import zipfile


def esc(text):
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;"))


INLINE_RE = re.compile(
    r"(?P<bold>\*\*(?P<bold_t>.+?)\*\*)"
    r"|(?P<italic>\*(?P<italic_t>.+?)\*)"
    r"|(?P<code>`(?P<code_t>[^`]+)`)"
    r"|(?P<fnref>\[\^(?P<fn_t>[^\]]+)\])"
    r"|(?P<link>\[(?P<link_t>[^\]]+)\]\((?P<link_u>[^)]+)\))"
)


def run_xml(text, *, bold=False, italic=False, code=False, sup=False):
    if text == "":
        return ""
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if sup:
        props.append('<w:vertAlign w:val="superscript"/>')
    if code:
        props.append('<w:rFonts w:ascii="Consolas" w:hAscii="Consolas"/>')
    rpr = "<w:rPr>" + "".join(props) + "</w:rPr>" if props else ""
    return (f"<w:r>{rpr}"
            f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')


def inline_runs(text, fnmap):
    """Convert an inline string to a list of run XML fragments."""
    out = []
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() > pos:
            out.append(run_xml(text[pos:m.start()]))
        if m.group("bold"):
            out.append(run_xml(m.group("bold_t"), bold=True))
        elif m.group("italic"):
            out.append(run_xml(m.group("italic_t"), italic=True))
        elif m.group("code"):
            out.append(run_xml(m.group("code_t"), code=True))
        elif m.group("fnref"):
            num = fnmap.get(m.group("fn_t"), "?")
            out.append(run_xml(str(num), sup=True, bold=True))
        elif m.group("link"):
            out.append(run_xml(m.group("link_t")))
        pos = m.end()
    if pos < len(text):
        out.append(run_xml(text[pos:]))
    return out


def para(runs_xml, *, style=None, bullet=False, rule=False):
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if bullet:
        ppr.append('<w:ind w:left="360" w:hanging="360"/>')
    if rule:
        ppr.append('<w:pBdr><w:bottom w:val="single" w:sz="6" '
                   'w:space="1" w:color="999999"/></w:pBdr>')
    ppr_xml = "<w:pPr>" + "".join(ppr) + "</w:pPr>" if ppr else ""
    body = "".join(runs_xml)
    if bullet:
        body = run_xml("•\t") + body
    return f"<w:p>{ppr_xml}{body}</w:p>"


def convert(md_text):
    lines = md_text.splitlines()

    # Pass 1 — collect footnote definitions in order, assign numbers.
    fndef_re = re.compile(r"^\[\^([^\]]+)\]:\s?(.*)$")
    fnmap = {}
    fndefs = []  # (number, raw_text)
    for ln in lines:
        m = fndef_re.match(ln)
        if m:
            fid = m.group(1)
            if fid not in fnmap:
                fnmap[fid] = len(fndefs) + 1
                fndefs.append([fnmap[fid], m.group(2)])
            else:
                fndefs[fnmap[fid] - 1][1] += " " + m.group(2)

    # Pass 2 — render blocks (skipping footnote-definition lines).
    paras = []
    for ln in lines:
        if fndef_re.match(ln):
            continue
        raw = ln.rstrip()
        stripped = raw.strip()
        if stripped == "":
            continue
        if stripped == "---":
            paras.append(para([run_xml("")], rule=True))
            continue
        if raw.startswith("#### "):
            paras.append(para(inline_runs(raw[5:], fnmap), style="Heading3"))
        elif raw.startswith("### "):
            paras.append(para(inline_runs(raw[4:], fnmap), style="Heading3"))
        elif raw.startswith("## "):
            paras.append(para(inline_runs(raw[3:], fnmap), style="Heading2"))
        elif raw.startswith("# "):
            paras.append(para(inline_runs(raw[2:], fnmap), style="Title"))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            paras.append(para(inline_runs(stripped[2:], fnmap), bullet=True))
        else:
            paras.append(para(inline_runs(raw, fnmap)))

    # Notes section (endnote-style footnotes).
    if fndefs:
        paras.append(para([run_xml("")], rule=True))
        paras.append(para([run_xml("Notes")], style="Heading2"))
        for num, txt in fndefs:
            runs = [run_xml(f"{num}. ", bold=True)] + inline_runs(txt, fnmap)
            paras.append(para(runs))

    return "".join(paras)


DOCUMENT_TMPL = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    "<w:body>{body}"
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
    '<w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/>'
    "</w:sectPr></w:body></w:document>"
)

STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    "<w:docDefaults><w:rPrDefault><w:rPr>"
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/>'
    "</w:rPr></w:rPrDefault></w:docDefaults>"
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
    '<w:name w:val="Normal"/><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/>'
    "</w:pPr></w:style>"
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>'
    '<w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr>'
    '<w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1F3864"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 1"/>'
    '<w:pPr><w:spacing w:before="280" w:after="120"/><w:keepNext/></w:pPr>'
    '<w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1F3864"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 2"/>'
    '<w:pPr><w:spacing w:before="200" w:after="80"/><w:keepNext/></w:pPr>'
    '<w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="2E4D7B"/></w:rPr></w:style>'
    "</w:styles>"
)

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    "</Types>"
)

ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
    'Target="word/document.xml"/></Relationships>'
)

DOC_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
    'Target="styles.xml"/></Relationships>'
)


def write_docx(body_xml, out_path):
    document = DOCUMENT_TMPL.format(body=body_xml)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", STYLES)
        z.writestr("word/_rels/document.xml.rels", DOC_RELS)


def main(argv):
    if len(argv) < 2:
        print("usage: md2docx.py input.md [output.docx]", file=sys.stderr)
        return 1
    src = argv[1]
    dst = argv[2] if len(argv) > 2 else os.path.splitext(src)[0] + ".docx"
    with open(src, "r", encoding="utf-8") as f:
        md = f.read()
    write_docx(convert(md), dst)
    print(f"wrote {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
