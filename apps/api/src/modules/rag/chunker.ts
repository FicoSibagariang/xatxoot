export interface ChunkerOptions {
  chunkSize?: number
  chunkOverlap?: number
}

/**
 * Memecah teks dokumen/artikel menjadi potongan (chunks) dengan batasan ukuran
 * dan overlap untuk keperluan semantic vector embeddings & RAG.
 */
export function chunkText(text: string, options: ChunkerOptions = {}): string[] {
  if (!text || typeof text !== 'string') return []
  const trimmed = text.trim()
  if (!trimmed) return []

  const chunkSize = options.chunkSize ?? 500
  const chunkOverlap = options.chunkOverlap ?? 100

  if (trimmed.length <= chunkSize) {
    return [trimmed]
  }

  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < trimmed.length) {
    let endIndex = startIndex + chunkSize
    if (endIndex >= trimmed.length) {
      const finalChunk = trimmed.slice(startIndex).trim()
      if (finalChunk) chunks.push(finalChunk)
      break
    }

    // Mencari pemisah alami paragraf atau kalimat di dekat batas chunkSize
    let breakPoint = trimmed.lastIndexOf('\n\n', endIndex)
    if (breakPoint <= startIndex || breakPoint < endIndex - 80) {
      breakPoint = trimmed.lastIndexOf('\n', endIndex)
    }
    if (breakPoint <= startIndex || breakPoint < endIndex - 50) {
      breakPoint = trimmed.lastIndexOf('. ', endIndex)
      if (breakPoint > startIndex) {
        breakPoint += 1 // Sertakan tanda titik
      }
    }
    if (breakPoint <= startIndex || breakPoint < endIndex - 40) {
      breakPoint = trimmed.lastIndexOf(' ', endIndex)
    }

    if (breakPoint > startIndex && breakPoint <= endIndex) {
      endIndex = breakPoint
    }

    const chunk = trimmed.slice(startIndex, endIndex).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    const stepForward = Math.max(1, endIndex - chunkOverlap)
    startIndex = stepForward > startIndex ? stepForward : endIndex
  }

  return chunks.filter((c) => c.length > 0)
}
