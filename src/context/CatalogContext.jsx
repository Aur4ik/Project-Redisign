import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
const Context = createContext(null);
export function CatalogProvider({ children }) {
  const { user } = useAuth();
  const [cars, setCars] = useState([]),
    [favorites, setFavorites] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function reload() {
    setLoading(true);
    setError("");
    try {
      setCars(await api("/cars"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);
  useEffect(() => {
    let live = true;
    setFavorites([]);
    if (user)
      api("/favorites")
        .then((ids) => {
          if (live) setFavorites(ids);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [user?.id]);
  async function toggle(id) {
    if (saving) return;
    setSaving(true);
    try {
      const exists = favorites.includes(id);
      await api("/favorites/" + id, {
        method: exists ? "DELETE" : "PUT",
        body: {},
      });
      setFavorites((old) =>
        exists ? old.filter((x) => x !== id) : [...old, id],
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Context.Provider
      value={{ cars, favorites, loading, error, reload, toggle, saving }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCatalog = () => useContext(Context);
