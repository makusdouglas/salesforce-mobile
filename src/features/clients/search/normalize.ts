// TODO: extract to a shared module once a third consumer needs it.
// Duplicated from src/features/catalog/search/normalize.ts per 007 research R-008.
export function normalize(input: string): string {
  return input.normalize('NFD').replace(/\p{Mn}/gu, '').toLocaleLowerCase('pt-BR').trim();
}
