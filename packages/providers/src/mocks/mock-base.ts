// Deterministic pseudo-random based on personId + salt — same input = same output
export function seededValue(personId: number, salt: string, min = 0, max = 100): number {
  let hash = personId * 2654435761;
  for (let i = 0; i < salt.length; i++) {
    hash = ((hash << 5) - hash + salt.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash) / 2147483647;
  return min + normalized * (max - min);
}
