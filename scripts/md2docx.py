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
  - bullet             -> Word bulleted list (numbering.xml)
  1. item              -> Word numbered list (numbering.xml); starts at the
                          first item's number, restarts for each new list
  indented items       -> nested bullets / numbers, mixed freely
  | a | b | + |---|    -> pipe table (header row repeats, :--: alignment)
  ![alt](img.png)      -> embedded PNG / JPEG on its own line, scaled down
                          to fit 6.5in (never up), alt text as caption
  [![alt](img)](href)  -> same image embedded; the link is dropped, like
                          [text](url) links (a relative mockup path means
                          nothing to a reader of the sent .docx)
  ---                  -> horizontal rule
  [text](url)          -> rendered as text (url dropped)
  [^id] ... [^id]: def -> footnote refs become superscript numbers;
                          definitions are collected into a "Notes" section
                          at the end (endnote style — robust in Word).

Image paths resolve relative to the input file. A missing or unreadable
image becomes an italic placeholder line and a warning on stderr.

Usage:
  python3 md2docx.py input.md [output.docx]
"""

import os
import re
import struct
import sys
import zipfile
from urllib.parse import unquote


def esc(text):
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;"))


INLINE_RE = re.compile(
    r"(?P<bold>\*\*(?P<bold_t>.+?)\*\*)"
    r"|(?P<italic>\*(?P<italic_t>.+?)\*)"
    r"|(?P<code>`(?P<code_t>[^`]+)`)"
    r"|(?P<fnref>\[\^(?P<fn_t>[^\]]+)\])"
    r"|(?P<img>!\[(?P<img_t>[^\]]*)\]\((?P<img_u>[^)]+)\))"
    r"|(?P<link>\[(?P<link_t>[^\]]+)\]\((?P<link_u>[^)]+)\))"
)


def run_xml(text, *, bold=False, italic=False, code=False, sup=False):
    if text == "":
        return ""
    props = []  # schema order: rFonts, b, i, vertAlign
    if code:
        props.append('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if sup:
        props.append('<w:vertAlign w:val="superscript"/>')
    rpr = "<w:rPr>" + "".join(props) + "</w:rPr>" if props else ""
    return (f"<w:r>{rpr}"
            f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')


def inline_runs(text, fnmap, *, bold=False):
    """Convert an inline string to a list of run XML fragments.

    bold=True makes every run bold (table header cells).
    """
    out = []
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() > pos:
            out.append(run_xml(text[pos:m.start()], bold=bold))
        if m.group("bold"):
            out.append(run_xml(m.group("bold_t"), bold=True))
        elif m.group("italic"):
            out.append(run_xml(m.group("italic_t"), bold=bold, italic=True))
        elif m.group("code"):
            out.append(run_xml(m.group("code_t"), bold=bold, code=True))
        elif m.group("fnref"):
            num = fnmap.get(m.group("fn_t"), "?")
            out.append(run_xml(str(num), sup=True, bold=True))
        elif m.group("img"):
            out.append(run_xml(m.group("img_t"), bold=bold, italic=True))
        elif m.group("link"):
            out.append(run_xml(m.group("link_t"), bold=bold))
        pos = m.end()
    if pos < len(text):
        out.append(run_xml(text[pos:], bold=bold))
    return out


def para(runs_xml, *, style=None, rule=False, num=None, align=None,
         space_after=None, keep_next=False):
    """num is (numId, ilvl) for a list paragraph."""
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if keep_next:
        ppr.append("<w:keepNext/>")
    if num:
        ppr.append(f'<w:numPr><w:ilvl w:val="{num[1]}"/>'
                   f'<w:numId w:val="{num[0]}"/></w:numPr>')
    if rule:
        ppr.append('<w:pBdr><w:bottom w:val="single" w:sz="6" '
                   'w:space="1" w:color="999999"/></w:pBdr>')
    if space_after is not None:
        ppr.append(f'<w:spacing w:after="{space_after}"/>')
    if align:
        ppr.append(f'<w:jc w:val="{align}"/>')
    ppr_xml = "<w:pPr>" + "".join(ppr) + "</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_xml}{''.join(runs_xml)}</w:p>"


# ---------------------------------------------------------------- images

EMU_PER_PX = 9525              # 96 dpi
MAX_WIDTH_EMU = int(6.5 * 914400)

IMAGE_LINE_RE = re.compile(
    r"^\s*(?:\[!\[(?P<lalt>[^\]]*)\]\((?P<lsrc>[^)]+)\)\]\((?P<href>[^)]+)\)"
    r"|!\[(?P<alt>[^\]]*)\]\((?P<src>[^)]+)\))\s*$"
)


def image_info(data):
    """Return (ext, width_px, height_px) for PNG / JPEG bytes, else None."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
        w, h = struct.unpack(">II", data[16:24])
        return "png", w, h
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7 or marker == 0xFF:
                i += 1 if marker == 0xFF else 2
                continue
            seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return "jpeg", w, h
            i += 2 + seg_len
    return None


def clean_src(src):
    """Strip an optional "title" and <angle brackets> from a link target."""
    src = src.strip()
    m = re.match(r'^(.*?)\s+["\'].*["\']$', src)
    if m:
        src = m.group(1)
    if src.startswith("<") and src.endswith(">"):
        src = src[1:-1]
    return src


def fit_emu(w_px, h_px):
    cx, cy = w_px * EMU_PER_PX, h_px * EMU_PER_PX
    if cx > MAX_WIDTH_EMU:
        cy = round(cy * MAX_WIDTH_EMU / cx)
        cx = MAX_WIDTH_EMU
    return cx, cy


def drawing_xml(rid, pic_id, name, alt, cx, cy):
    return (
        "<w:r><w:drawing>"
        '<wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{pic_id}" name="Picture {pic_id}" descr="{esc(alt)}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/>'
        "</wp:cNvGraphicFramePr>"
        '<a:graphic><a:graphicData '
        'uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        "<pic:pic>"
        f'<pic:nvPicPr><pic:cNvPr id="{pic_id}" name="{esc(name)}"/>'
        "<pic:cNvPicPr/></pic:nvPicPr>"
        f'<pic:blipFill><a:blip r:embed="{rid}"/>'
        "<a:stretch><a:fillRect/></a:stretch></pic:blipFill>"
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        "</pic:pic></a:graphicData></a:graphic>"
        "</wp:inline></w:drawing></w:r>"
    )


def image_block(alt, src, ctx):
    """Embed one image + caption. Returns paragraph XML."""
    src = clean_src(src)
    data = None
    for cand in (src, unquote(src)):
        path = cand if os.path.isabs(cand) else os.path.join(ctx["base"], cand)
        if os.path.isfile(path):
            with open(path, "rb") as f:
                data = f.read()
            break
    info = image_info(data) if data else None
    if not info:
        why = "not found" if data is None else "not a PNG or JPEG"
        print(f"warning: image {src} {why}", file=sys.stderr)
        label = alt or src
        return para([run_xml(f"[image: {label}]", italic=True)])
    ext, w, h = info
    n = len(ctx["media"]) + 1
    name = f"image{n}.{ext}"
    rid = f"rIdImg{n}"
    ctx["media"].append((name, rid, data))
    cx, cy = fit_emu(w, h)
    out = para([drawing_xml(rid, n, name, alt, cx, cy)],
               align="center", keep_next=bool(alt), space_after=60)
    if alt:
        out += para(inline_runs(alt, ctx["fnmap"]), style="Caption")
    return out


# ---------------------------------------------------------------- lists

LIST_RE = re.compile(r"^(?P<ind>[ \t]*)(?:(?P<bul>[-*+])|(?P<num>\d+)[.)])[ \t]+(?P<text>.*)$")
BULLET_NUM_ID = 1


class Lists:
    """Track nesting and Word numbering instances across consecutive items."""

    def __init__(self):
        self.next_num_id = BULLET_NUM_ID + 1
        self.instances = []   # (numId, ilvl, start) for numbered lists
        self.reset()

    def reset(self):
        self.indents = []     # indent per open level
        self.seq = []         # numId in use per open level

    def item(self, indent, numbered, start):
        while self.indents and indent < self.indents[-1]:
            self.indents.pop()
            self.seq.pop()
        if not self.indents or indent > self.indents[-1]:
            if len(self.indents) < 9:
                self.indents.append(indent)
                self.seq.append(None)
            else:
                self.indents[-1] = indent
        lvl = len(self.indents) - 1
        cur = self.seq[lvl]
        if numbered:
            if cur is None or cur == BULLET_NUM_ID:
                cur = self.next_num_id
                self.next_num_id += 1
                self.instances.append((cur, lvl, start))
        else:
            cur = BULLET_NUM_ID
        self.seq[lvl] = cur
        return cur, lvl


BULLET_CHARS = ["•", "◦", "▪"]
NUMBER_FMTS = ["decimal", "lowerLetter", "lowerRoman"]


def numbering_xml(instances):
    def lvl_ind(i):
        return f'<w:pPr><w:ind w:left="{360 + 360 * i}" w:hanging="360"/></w:pPr>'

    bullets = "".join(
        f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/>'
        f'<w:lvlText w:val="{BULLET_CHARS[i % 3]}"/><w:lvlJc w:val="left"/>'
        f"{lvl_ind(i)}</w:lvl>"
        for i in range(9))
    numbers = "".join(
        f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/>'
        f'<w:numFmt w:val="{NUMBER_FMTS[i % 3]}"/>'
        f'<w:lvlText w:val="%{i + 1}."/><w:lvlJc w:val="left"/>'
        f"{lvl_ind(i)}</w:lvl>"
        for i in range(9))
    nums = [f'<w:num w:numId="{BULLET_NUM_ID}"><w:abstractNumId w:val="0"/></w:num>']
    for num_id, lvl, start in instances:
        nums.append(
            f'<w:num w:numId="{num_id}"><w:abstractNumId w:val="1"/>'
            f'<w:lvlOverride w:ilvl="{lvl}"><w:startOverride w:val="{start}"/>'
            "</w:lvlOverride></w:num>")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>'
        f"{bullets}</w:abstractNum>"
        '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>'
        f"{numbers}</w:abstractNum>"
        + "".join(nums) + "</w:numbering>"
    )


# ---------------------------------------------------------------- tables

TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$")
TABLE_WIDTH = 9360             # 6.5in in twips


def split_row(line):
    """Split a pipe-table row into cells; honours \\| and `code | spans`."""
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    cells, cur, in_code, i = [], "", False, 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            cur += "|"
            i += 2
            continue
        if c == "`":
            in_code = not in_code
        if c == "|" and not in_code:
            cells.append(cur.strip())
            cur = ""
        else:
            cur += c
        i += 1
    cells.append(cur.strip())
    return cells


def table_xml(header, aligns, rows, fnmap):
    ncol = len(header)
    rows = [(r + [""] * ncol)[:ncol] for r in rows]
    def weight(cell):
        # Monospaced `code` sets ~1.5x wider than Calibri body text.
        return len(cell) * (1.5 if "`" in cell else 1)

    weights = [max(8, min(60, max(weight(r[c]) for r in [header] + rows)))
               for c in range(ncol)]
    widths = [TABLE_WIDTH * w // sum(weights) for w in weights]
    border = '<w:{0} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>'
    borders = "".join(border.format(b) for b in
                      ("top", "left", "bottom", "right", "insideH", "insideV"))
    out = [
        "<w:tbl><w:tblPr>"
        f'<w:tblW w:w="{TABLE_WIDTH}" w:type="dxa"/>'
        f"<w:tblBorders>{borders}</w:tblBorders>"
        '<w:tblLayout w:type="fixed"/>'
        '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/>'
        '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
        '<w:tblLook w:val="04A0" w:firstRow="1"/>'
        "</w:tblPr><w:tblGrid>"
        + "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
        + "</w:tblGrid>"
    ]
    for ri, row in enumerate([header] + rows):
        is_head = ri == 0
        trpr = "<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>" if is_head \
            else "<w:trPr><w:cantSplit/></w:trPr>"
        cells = []
        for c, text in enumerate(row):
            shd = '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>' if is_head else ""
            runs = inline_runs(text, fnmap, bold=is_head)
            cells.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{widths[c]}" w:type="dxa"/>{shd}</w:tcPr>'
                + para(runs, space_after=0, align=aligns[c]) + "</w:tc>")
        out.append(f"<w:tr>{trpr}{''.join(cells)}</w:tr>")
    out.append("</w:tbl>")
    # Word needs a paragraph between adjacent tables; it also gives breathing room.
    out.append(para([], space_after=120))
    return "".join(out)


def col_align(spec):
    spec = spec.strip()
    if spec.startswith(":") and spec.endswith(":"):
        return "center"
    if spec.endswith(":"):
        return "right"
    return None


# ---------------------------------------------------------------- blocks

def convert(md_text, base_dir="."):
    """Return (body_xml, media, numbering_instances)."""
    lines = md_text.expandtabs(4).splitlines()

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

    ctx = {"base": base_dir, "media": [], "fnmap": fnmap}
    lists = Lists()

    # Pass 2 — render blocks (skipping footnote-definition lines).
    paras = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        i += 1
        if fndef_re.match(ln):
            continue
        raw = ln.rstrip()
        stripped = raw.strip()
        if stripped == "":
            continue
        lm = LIST_RE.match(raw) if stripped != "---" else None
        if not lm:
            lists.reset()
        if stripped == "---":
            paras.append(para([run_xml("")], rule=True))
            continue
        if "|" in stripped and i < len(lines) and TABLE_SEP_RE.match(lines[i]) \
                and "-" in lines[i]:
            header = split_row(raw)
            aligns = [col_align(s) for s in split_row(lines[i])]
            aligns = (aligns + [None] * len(header))[:len(header)]
            i += 1
            rows = []
            while i < len(lines) and "|" in lines[i] and lines[i].strip():
                rows.append(split_row(lines[i]))
                i += 1
            paras.append(table_xml(header, aligns, rows, fnmap))
            continue
        im = IMAGE_LINE_RE.match(raw)
        if im:
            if im.group("lsrc"):
                paras.append(image_block(im.group("lalt"), im.group("lsrc"), ctx))
            else:
                paras.append(image_block(im.group("alt"), im.group("src"), ctx))
            continue
        if raw.startswith("#### "):
            paras.append(para(inline_runs(raw[5:], fnmap), style="Heading3"))
        elif raw.startswith("### "):
            paras.append(para(inline_runs(raw[4:], fnmap), style="Heading3"))
        elif raw.startswith("## "):
            paras.append(para(inline_runs(raw[3:], fnmap), style="Heading2"))
        elif raw.startswith("# "):
            paras.append(para(inline_runs(raw[2:], fnmap), style="Title"))
        elif lm:
            numbered = lm.group("num") is not None
            start = int(lm.group("num")) if numbered else 1
            num = lists.item(len(lm.group("ind")), numbered, start)
            paras.append(para(inline_runs(lm.group("text"), fnmap),
                              num=num, space_after=60))
        else:
            paras.append(para(inline_runs(raw, fnmap)))

    # Notes section (endnote-style footnotes).
    if fndefs:
        paras.append(para([run_xml("")], rule=True))
        paras.append(para([run_xml("Notes")], style="Heading2"))
        for num, txt in fndefs:
            runs = [run_xml(f"{num}. ", bold=True)] + inline_runs(txt, fnmap)
            paras.append(para(runs))

    return "".join(paras), ctx["media"], lists.instances


DOCUMENT_TMPL = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
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
    '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/>'
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr>'
    '<w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="595959"/></w:rPr></w:style>'
    "</w:styles>"
)

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Default Extension="png" ContentType="image/png"/>'
    '<Default Extension="jpeg" ContentType="image/jpeg"/>'
    '<Override PartName="/word/document.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '<Override PartName="/word/styles.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    '<Override PartName="/word/numbering.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
    "</Types>"
)

ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
    'Target="word/document.xml"/></Relationships>'
)

REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"


def doc_rels(media):
    rels = [
        f'<Relationship Id="rId1" Type="{REL_TYPE}styles" Target="styles.xml"/>',
        f'<Relationship Id="rId2" Type="{REL_TYPE}numbering" Target="numbering.xml"/>',
    ]
    for name, rid, _ in media:
        rels.append(f'<Relationship Id="{rid}" Type="{REL_TYPE}image" '
                    f'Target="media/{name}"/>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(rels) + "</Relationships>"
    )


def write_docx(body_xml, out_path, media=(), instances=()):
    document = DOCUMENT_TMPL.format(body=body_xml)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("word/document.xml", document)
        z.writestr("word/styles.xml", STYLES)
        z.writestr("word/numbering.xml", numbering_xml(instances))
        z.writestr("word/_rels/document.xml.rels", doc_rels(media))
        for name, _, data in media:
            z.writestr(f"word/media/{name}", data)


def main(argv):
    if len(argv) < 2:
        print("usage: md2docx.py input.md [output.docx]", file=sys.stderr)
        return 1
    src = argv[1]
    dst = argv[2] if len(argv) > 2 else os.path.splitext(src)[0] + ".docx"
    with open(src, "r", encoding="utf-8") as f:
        md = f.read()
    body, media, instances = convert(md, os.path.dirname(os.path.abspath(src)))
    write_docx(body, dst, media, instances)
    print(f"wrote {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
