import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocFromServer,
  FirestoreError,
} from 'firebase/firestore';
import { RoadCase } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { onAuthStateChanged };
export type { FirebaseUser };
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)');

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'citizen' | 'official';
  createdAt: string;
}

// Security error handler conforming to skill specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline or awaiting initial document sync.');
    }
  }
}

// Auth Helpers
const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(defaultRole: 'citizen' | 'official' = 'citizen'): Promise<UserProfile> {
  const cred = await signInWithPopup(auth, googleProvider);
  const fbUser = cred.user;
  return syncUserProfile(fbUser, defaultRole);
}

export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string,
  role: 'citizen' | 'official'
): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const fbUser = cred.user;
  const userProfile: UserProfile = {
    uid: fbUser.uid,
    email: fbUser.email || email,
    displayName: displayName || (role === 'official' ? 'Municipal Inspector' : 'Citizen Reporter'),
    role,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'users', fbUser.uid), userProfile);
    if (role === 'official' || fbUser.email?.toLowerCase() === 'nirbhayg759@gmail.com') {
      await setDoc(doc(db, 'admins', fbUser.uid), {
        uid: fbUser.uid,
        email: fbUser.email || email,
        role: 'official',
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
  }

  return userProfile;
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return syncUserProfile(cred.user, 'citizen');
}

export async function logoutUser() {
  await signOut(auth);
}

export async function syncUserProfile(fbUser: FirebaseUser, defaultRole: 'citizen' | 'official'): Promise<UserProfile> {
  const userRef = doc(db, 'users', fbUser.uid);
  let userProfile: UserProfile;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      userProfile = snap.data() as UserProfile;
    } else {
      // Determine if email is the configured admin
      const isDeveloperAdmin = fbUser.email?.toLowerCase() === 'nirbhayg759@gmail.com';
      const role = isDeveloperAdmin ? 'official' : defaultRole;

      userProfile = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || (role === 'official' ? 'Civil Engineer' : 'Citizen Reporter'),
        role,
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, userProfile);

      if (role === 'official') {
        await setDoc(doc(db, 'admins', fbUser.uid), {
          uid: fbUser.uid,
          email: fbUser.email || '',
          role: 'official',
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
    throw err;
  }

  return userProfile;
}

// Case Database API
export async function saveCaseToFirestore(roadCase: RoadCase): Promise<void> {
  try {
    await setDoc(doc(db, 'cases', roadCase.id), {
      ...roadCase,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `cases/${roadCase.id}`);
  }
}

export async function updateCaseInFirestore(caseId: string, updates: Partial<RoadCase>): Promise<void> {
  try {
    await updateDoc(doc(db, 'cases', caseId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `cases/${caseId}`);
  }
}

// Cases Listener
export function subscribeToCases(
  profile: UserProfile | null,
  onCases: (cases: RoadCase[]) => void,
  onError?: (err: Error) => void
) {
  if (!profile) {
    onCases([]);
    return () => {};
  }

  const casesCollection = collection(db, 'cases');

  // Authority/Admin gets to see ALL cases; Citizen sees ONLY their own published cases!
  const q =
    profile.role === 'official'
      ? query(casesCollection)
      : query(casesCollection, where('citizenId', '==', profile.uid));

  return onSnapshot(
    q,
    (snapshot: any) => {
      const casesList: RoadCase[] = [];
      snapshot.forEach((docSnap: any) => {
        casesList.push(docSnap.data() as RoadCase);
      });
      // Sort in-memory by createdAt descending
      casesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onCases(casesList);
    },
    (err: any) => {
      handleFirestoreError(err, OperationType.LIST, 'cases');
      if (onError) onError(err);
    }
  );
}
