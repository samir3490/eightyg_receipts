import { collection, doc, Firestore } from 'firebase/firestore';
import { SHARED_WORKSPACE_ID, type DataCollectionName } from '../constants/firestore';

export function dataCollection(db: Firestore, name: DataCollectionName) {
  return collection(db, 'users', SHARED_WORKSPACE_ID, name);
}

export function dataDoc(db: Firestore, name: DataCollectionName, id: string) {
  return doc(db, 'users', SHARED_WORKSPACE_ID, name, id);
}
