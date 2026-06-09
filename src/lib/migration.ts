// Legacy Firebase migration helpers — disabled after moving to Lovable Cloud (Supabase).
export interface MigrationReport {
  scannedCollections: string[];
  importedUsers: number;
  importedSchools: number;
  importedMemberships: number;
  warnings: string[];
}

export async function scanLegacyShape(): Promise<{ collections: string[]; rtdb: Record<string, number> }> {
  return { collections: [], rtdb: {} };
}

export async function runMigration(): Promise<MigrationReport> {
  return {
    scannedCollections: [],
    importedUsers: 0,
    importedSchools: 0,
    importedMemberships: 0,
    warnings: ["Migração desativada — dados agora vivem no Lovable Cloud."],
  };
}
