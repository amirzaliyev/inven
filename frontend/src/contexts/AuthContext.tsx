import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { login as apiLogin } from "../api/auth";

interface JwtPayload {
  sub: string;
  display_name: string;
  username: string;
}

interface AuthUser {
  sub: string;
  display_name: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
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

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, login, logout }}
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
