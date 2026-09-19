
'use client';
import { getAuth, type User } from 'firebase/auth';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface FirebaseAuthToken {
  name: string | null;
  email: string | null;
  email_verified: boolean;
  phone_number: string | null;
  sub: string;
  firebase: {
    identities: Record<string, string[]>;
    sign_in_provider: string;
    tenant: string | null;
  };
}

interface FirebaseAuthObject {
  uid: string;
  token: FirebaseAuthToken;
}

interface SecurityRuleRequest {
  auth: FirebaseAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

function buildAuthObject(currentUser: User | null): FirebaseAuthObject | null {
  if (!currentUser) return null;

  return {
    uid: currentUser.uid,
    token: {
      name: currentUser.displayName,
      email: currentUser.email,
      email_verified: currentUser.emailVerified,
      phone_number: currentUser.phoneNumber,
      sub: currentUser.uid,
      firebase: {
        identities: currentUser.providerData.reduce((acc, p) => {
          if (p.providerId) acc[p.providerId] = [p.uid];
          return acc;
        }, {} as Record<string, string[]>),
        sign_in_provider: currentUser.providerData[0]?.providerId || 'custom',
        tenant: currentUser.tenantId,
      },
    },
  };
}

function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  let authObject: FirebaseAuthObject | null = null;
  try {
    const firebaseAuth = getAuth();
    if (firebaseAuth.currentUser) authObject = buildAuthObject(firebaseAuth.currentUser);
  } catch {}

  return {
    auth: authObject,
    method: context.operation,
    path: `/databases/(default)/documents/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

function buildErrorMessage(requestObject: SecurityRuleRequest, originalMessage?: string): string {
  let requestString = "indisponível";
  try {
    requestString = JSON.stringify(requestObject, (key, value) => {
      // Evita erros de serialização de objetos complexos do Firebase
      if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'FieldValue') {
        return '<FieldValue>';
      }
      return value;
    }, 2);
  } catch (e) {
    requestString = "[Erro ao serializar detalhes da requisição]";
  }

  if (originalMessage && !originalMessage.includes("Missing or insufficient permissions")) {
    return `Firestore Error: ${originalMessage}\n\nContextual Security Rule simulation:\n${requestString}`;
  }
  
  return `Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${requestString}`;
}

export class FirestorePermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext, originalError?: any) {
    const requestObject = buildRequestObject(context);
    const message = buildErrorMessage(requestObject, originalError?.message);
    super(message);
    this.name = 'FirebaseError';
    this.request = requestObject;
  }
}
