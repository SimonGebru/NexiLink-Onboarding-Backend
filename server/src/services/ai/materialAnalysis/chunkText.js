export function chunkText(text, size = 8000) {
  const chunks = [];
  let index = 0;

  while (index < text.length) {
    chunks.push(text.slice(index, index + size));
    index += size;
  }

  return chunks;
}