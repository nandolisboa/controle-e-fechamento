import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Verifique a configuração do Firebase: o cliente está offline.');
    }
  }
}

export async function signInWithGoogle(rememberUser = true): Promise<User> {
  await setPersistence(auth, rememberUser ? browserLocalPersistence : browserSessionPersistence);
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithPassword(password: string, rememberUser = true): Promise<User> {
  await setPersistence(auth, rememberUser ? browserLocalPersistence : browserSessionPersistence);
  const result = await signInWithEmailAndPassword(auth, 'aramesprojeto@gmail.com', password);
  return result.user;
}

export async function createLinkedPassword(user: User, password: string): Promise<void> {
  if (user.email?.toLowerCase() !== 'aramesprojeto@gmail.com' || !user.emailVerified) throw new Error('Conta não autorizada ou e-mail não verificado.');
  await reauthenticateWithPopup(user, googleProvider);
  await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

export async function resetLinkedPassword(): Promise<void> {
  await sendPasswordResetEmail(auth, 'aramesprojeto@gmail.com');
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
