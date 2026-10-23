/** Default redaction applied to session excerpts before they reach a model. */

function compile(pattern) {
  try {
    return new RegExp(pattern, 'giu')
  } catch {
    try {
      return new RegExp(pattern, 'gi')
    } catch {
      return undefined
    }
  }
}

/**
 * Replace configured secret-like values with a visible redaction marker.
 * @param {string} text input text.
 * @param {readonly string[]} patterns regex source strings.
 * @returns redacted text; non-strings become an empty string.
 */
export function redact(text, patterns) {
  if (typeof text !== 'string' || text.length === 0) return ''
  let output = text
  for (const pattern of patterns ?? []) {
    const regex = compile(pattern)
    if (regex !== undefined) output = output.replace(regex, '[REDACTED]')
  }
  return output
}

/** Keep only a bounded UTF-8 prefix, never splitting a multi-byte character. */
export function truncateUtf8(text, maxBytes) {
  if (typeof text !== 'string') return ''
  const limit = Math.max(0, Math.trunc(maxBytes))
  if (Buffer.byteLength(text, 'utf8') <= limit) return text
  const bytes = Buffer.from(text, 'utf8')
  let end = Math.min(limit, bytes.length)
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1
  return bytes.subarray(0, end).toString('utf8')
}
