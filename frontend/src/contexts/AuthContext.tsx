import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { login as apiLogin, logout as apiLogout } from "../api/auth";

interface JwtPayload {
  sub: string;
  display_name: string;
  username: string;
  role: string;
  permissions: string[];
  must_change_password: boolean;
}

interface AuthUser {
  sub: string;
  display_name: string;
  username: string;
  role: string;
  permissions: string[];
  must_change_password: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

function getUserFromStorage(): AuthUser | null {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  return decodeJwt(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getUserFromStorage);

  useEffect(() => {
    setUser(getUserFromStorage());
  }, []);

  async function login(username: string, password: string) {
    const tokens = await apiLogin({ username, password });
    localStorage.setItem("access_token", tokens.access_token);
    const decoded = decodeJwt(tokens.access_token);
    setUser(decoded);
  }

  async function logout() {
    try {
      await apiLogout();
    } catch {
      // proceed with local cleanup even if backend call fails
    }
    localStorage.removeItem("access_token");
    setUser(null);
  }

  function updateToken(token: string) {
    localStorage.setItem("access_token", token);
    const decoded = decodeJwt(token);
    setUser(decoded);
  }

  function hasPermission(permission: string): boolean {
    return user?.permissions?.includes(permission) ?? false;
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, hasPermission, login, logout, updateToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
