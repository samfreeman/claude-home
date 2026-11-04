// Text extraction for documents that aren't UTF-8 text (PDF, Office, OpenDocument, Numbers).
// The Converter interface keeps the tools portable; aiConverter is the Cloudflare implementation.

export interface ConvertedText {
	markdown: string
	tokens?: number
}

export type Converter = (document: { name: string, bytes: Uint8Array, mimeType: string }) => Promise<ConvertedText>

// The binary formats Workers AI's toMarkdown supports. Text formats it also supports (HTML, XML,
// CSV, SVG) are UTF-8 and are returned verbatim instead.
const convertibleByExtension: Record<string, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
	xlsb: 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
	xls: 'application/vnd.ms-excel',
	et: 'application/vnd.ms-excel',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	odt: 'application/vnd.oasis.opendocument.text',
	numbers: 'application/vnd.apple.numbers'
}

const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2d]

export function convertibleType(name: string, bytes: Uint8Array) {
	if (pdfSignature.every((b, i) => bytes[i] == b))
		return 'application/pdf'
	const dot = name.lastIndexOf('.')
	return dot < 0 ? undefined : convertibleByExtension[name.slice(dot + 1).toLowerCase()]
}

export function aiConverter(ai: Ai): Converter {
	return async ({ name, bytes, mimeType }) => {
		const result = await ai.toMarkdown(
			{ name, blob: new Blob([bytes], { type: mimeType }) },
			// Embedded images would be described by AI models, which costs neurons; the built-in
			// Dropbox connector returns text only, so this does too
			{ conversionOptions: { pdf: { images: { convert: false } }, docx: { images: { convert: false } } } })
		if (result.format == 'error')
			throw new Error(result.error)
		return { markdown: result.data, tokens: result.tokens }
	}
}
