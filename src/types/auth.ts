export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
  allowedEmail: string;
  isConfigured: boolean;
  token?: string;
  message?: string;
}
