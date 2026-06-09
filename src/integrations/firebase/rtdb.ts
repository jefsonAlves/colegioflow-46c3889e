// Legacy shim — kept only so old imports continue to type-check during migration.
export async function readNode<T = unknown>(_path: string): Promise<T | null> {
  return null;
}
export async function listTopLevel(): Promise<Record<string, number>> {
  return {};
}
