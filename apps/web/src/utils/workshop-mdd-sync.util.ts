import { serverWouldDropGovernancePatterns } from "@theforge/shared-types";
import { workshopDocumentBodiesEqual } from "./workshop-document-content.util.js";

/** Decide qué MDD aplicar tras `fetchProject` (servidor vs editor local). */
export function resolveMddFetchMerge(options: {
  switchingProject: boolean;
  sameProjectLoaded: boolean;
  mddPersisting: boolean;
  localMdd: string;
  persistedMdd: string;
  serverMdd: string;
}): {
  preserveMddLocal: boolean;
  nextMddContent: string;
  updatePersistedBaseline: boolean;
} {
  const {
    switchingProject,
    sameProjectLoaded,
    mddPersisting,
    localMdd,
    persistedMdd,
    serverMdd,
  } = options;
  const canPreserveLocalMdd = sameProjectLoaded && !switchingProject;
  const localHasMdd = localMdd.trim().length > 0;
  const serverDropsPatterns =
    canPreserveLocalMdd && serverWouldDropGovernancePatterns(localMdd, serverMdd);
  const hasUnsavedEditorChanges =
    canPreserveLocalMdd &&
    !mddPersisting &&
    !workshopDocumentBodiesEqual(localMdd, persistedMdd);
  const serverDiffersFromLocal = !workshopDocumentBodiesEqual(localMdd, serverMdd);
  const localMatchesPersisted = workshopDocumentBodiesEqual(localMdd, persistedMdd);
  const preserveSavedLocalOverStaleServer =
    canPreserveLocalMdd &&
    localHasMdd &&
    localMatchesPersisted &&
    serverDiffersFromLocal;
  const preserveMddLocal =
    (canPreserveLocalMdd && mddPersisting) ||
    serverDropsPatterns ||
    (hasUnsavedEditorChanges && serverDiffersFromLocal) ||
    preserveSavedLocalOverStaleServer;
  const nextMddContent = preserveMddLocal ? localMdd : serverMdd;
  const updatePersistedBaseline = !(preserveMddLocal && hasUnsavedEditorChanges);
  return { preserveMddLocal, nextMddContent, updatePersistedBaseline };
}
