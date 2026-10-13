export const RAG_EMBEDDING_DIMENSION = 1536

/**
 * Normalisasi L2 dari sebuah vektor (unit vector)
 */
export function normalizeVector(vector: number[]): number[] {
  let sumSq = 0
  for (const v of vector) {
    sumSq += v * v
  }
  const magnitude = Math.sqrt(sumSq)
  if (magnitude === 0) return vector
  return vector.map((v) => Number((v / magnitude).toFixed(6)))
}

/**
 * Menghitung cosine similarity antara dua vektor
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0
  return dotProduct / denominator
}

/**
 * Format array angka menjadi string literal pgvector (misal "[0.1,0.2,-0.5]")
 */
export function formatVectorForPg(vector: number[]): string {
  return `[${vector.join(',')}]`
}

/**
 * Pembangkitan embedding vektor deterministik berdimensi 1536.
 * Menggunakan proyeksi hash berbasis token (bag-of-words & n-grams) dengan normalisasi L2.
 * Menghasilkan representasi vektor semantik offline yang konsisten dan kompatibel dengan PostgreSQL pgvector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const vector = new Array(RAG_EMBEDDING_DIMENSION).fill(0)
  if (!text || text.trim().length === 0) {
    return vector
  }

  const normalized = text.toLowerCase()
  const words = normalized
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (words.length === 0) {
    return vector
  }

  // Proyeksikan setiap kata dan unigram/bigram ke dimensi vektor
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    hashWordToVector(word, vector, 1.0)

    // Bigram untuk konteks frasa
    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`
      hashWordToVector(bigram, vector, 1.5)
    }
  }

  return normalizeVector(vector)
}

function hashWordToVector(token: string, targetVector: number[], weight: number): void {
  // Hash token menjadi beberapa index berbobot di rentang 0..1535
  let hash1 = 2166136261
  let hash2 = 1000000007

  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i)
    hash1 = (hash1 ^ code) * 16777619
    hash2 = (hash2 ^ (code * (i + 1))) * 1099511628211
  }

  const dimIndex1 = Math.abs(hash1) % RAG_EMBEDDING_DIMENSION
  const dimIndex2 = Math.abs(hash2) % RAG_EMBEDDING_DIMENSION
  const dimIndex3 = (dimIndex1 + dimIndex2) % RAG_EMBEDDING_DIMENSION

  const sign1 = hash1 % 2 === 0 ? 1 : -1
  const sign2 = hash2 % 2 === 0 ? 1 : -1

  targetVector[dimIndex1] += sign1 * weight
  targetVector[dimIndex2] += sign2 * (weight * 0.75)
  targetVector[dimIndex3] += sign1 * sign2 * (weight * 0.5)
}
