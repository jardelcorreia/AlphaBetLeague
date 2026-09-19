
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  try {
    setDoc(docRef, data, options).catch(firebaseError => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data,
        }, firebaseError)
      )
    })
  } catch (err: any) {
    console.error("Erro síncrono no setDocumentNonBlocking:", err);
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: data,
      }, err)
    )
  }
}

export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  try {
    return addDoc(colRef, data).catch(firebaseError => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        }, firebaseError)
      )
    });
  } catch (err: any) {
    console.error("Erro síncrono no addDocumentNonBlocking:", err);
    return Promise.reject(err);
  }
}

export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  try {
    updateDoc(docRef, data).catch(firebaseError => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        }, firebaseError)
      )
    });
  } catch (err: any) {
    console.error("Erro síncrono no updateDocumentNonBlocking:", err);
  }
}

export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  try {
    deleteDoc(docRef).catch(firebaseError => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        }, firebaseError)
      )
    });
  } catch (err: any) {
    console.error("Erro síncrono no deleteDocumentNonBlocking:", err);
  }
}
