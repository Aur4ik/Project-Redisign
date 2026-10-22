import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    setLoading(true);
    try {
      setUser(await api("/me"));
      setError("");
    } catch (e) {
      setUser(null);
      setError(e.status === 401 ? "" : e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function authenticate(mode, values) {
    const next = await api("/auth/" + mode, { method: "POST", body: values });
    setUser(next);
    setError("");
    return next;
  }
  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} });
    setUser(null);
  }
  return (
    <Context.Provider
      value={{ user, loading, error, authenticate, logout, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
