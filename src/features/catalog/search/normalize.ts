export function normalize(input: string): string {
  return input.normalize('NFD').replace(/\p{Mn}/gu, '').toLocaleLowerCase('pt-BR').trim();
}
