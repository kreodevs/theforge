import { serverWouldDropGovernancePatterns } from "@theforge/shared-types";
import { workshopDocumentBodiesEqual } from "./workshop-document-content.util.js";

/** Decide qué MDD aplicar tras `fetchProject` (servidor vs editor local). */
export function resolveMddFetchMerge(options: {
  switchingProject: boolean;
  sameProjectLoaded: boolean;
  mddPersisting: boolean;
  /** Job MDD en background: aplicar servidor aunque local === baseline guardado. */
  preferServerMdd?: boolean;
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
    preferServerMdd = false,
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

  if (
    preferServerMdd &&
    canPreserveLocalMdd &&
    serverMdd.trim().length > 0 &&
    serverDiffersFromLocal &&
    !hasUnsavedEditorChanges
  ) {
    return {
      preserveMddLocal: false,
      nextMddContent: serverMdd,
      updatePersistedBaseline: true,
    };
  }

  const preserveSavedLocalOverStaleServer =
    canPreserveLocalMdd &&
    !preferServerMdd &&
    localHasMdd &&
    localMatchesPersisted &&
    serverDiffersFromLocal;
  const preserveMddLocal =
    (canPreserveLocalMdd && mddPersisting) ||
    (!preferServerMdd && serverDropsPatterns) ||
    (hasUnsavedEditorChanges && serverDiffersFromLocal) ||
    preserveSavedLocalOverStaleServer;
  const nextMddContent = preserveMddLocal ? localMdd : serverMdd;
  const updatePersistedBaseline = !(preserveMddLocal && hasUnsavedEditorChanges);
  return { preserveMddLocal, nextMddContent, updatePersistedBaseline };
}
