import { RoadCase } from '../types';

const DB_NAME = 'goodways_offline_db';
const DB_VERSION = 1;
const DRAFTS_STORE = 'drafts';

export interface OfflineDraft {
  localId: string;
  createdAt: string;
  syncStatus: 'draft' | 'pending_sync' | 'uploading' | 'failed' | 'submitted';
  syncedCaseId?: string;
  errorMessage?: string;
  retryCount: number;
  caseData: Partial<RoadCase> & {
    originalImageUrl: string;
    summary: string;
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        const store = db.createObjectStore(DRAFTS_STORE, { keyPath: 'localId' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineDraft(
  draft: Omit<OfflineDraft, 'localId' | 'createdAt' | 'retryCount'> & { localId?: string }
): Promise<OfflineDraft> {
  const db = await openDatabase();
  const fullDraft: OfflineDraft = {
    localId: draft.localId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    ...draft,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = tx.objectStore(DRAFTS_STORE);
    const req = store.put(fullDraft);
    req.onsuccess = () => resolve(fullDraft);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineDrafts(): Promise<OfflineDraft[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, 'readonly');
    const store = tx.objectStore(DRAFTS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function updateDraftStatus(
  localId: string,
  status: OfflineDraft['syncStatus'],
  syncedCaseId?: string,
  errorMessage?: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = tx.objectStore(DRAFTS_STORE);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const draft = getReq.result as OfflineDraft | undefined;
      if (!draft) {
        resolve();
        return;
      }
      draft.syncStatus = status;
      if (syncedCaseId) draft.syncedCaseId = syncedCaseId;
      if (errorMessage !== undefined) draft.errorMessage = errorMessage;
      if (status === 'failed') draft.retryCount = (draft.retryCount || 0) + 1;
      store.put(draft);
      resolve();
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteOfflineDraft(localId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = tx.objectStore(DRAFTS_STORE);
    const req = store.delete(localId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
