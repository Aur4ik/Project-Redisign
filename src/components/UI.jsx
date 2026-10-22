import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import CarArt from "./CarArt";
export function ErrorBox({ message }) {
  return message ? (
    <div role="alert" className="error-box">
      {message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <span className="spinner" />
      Загружаем данные…
    </div>
  );
}
export function CarVisual({ car, hero = false }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [car.image]);
  return car.image && !broken ? (
    <img
      className={"car-photo " + (hero ? "hero-photo" : "")}
      src={car.image}
      alt={`${car.brand} ${car.model}`}
      onError={() => setBroken(true)}
      loading={hero ? "eager" : "lazy"}
    />
  ) : (
    <CarArt car={car} hero={hero} />
  );
}
export function FavoriteButton({ car }) {
  const { user } = useAuth(),
    { favorites, toggle, saving } = useCatalog(),
    navigate = useNavigate(),
    location = useLocation();
  const [error, setError] = useState("");
  const saved = favorites.includes(car.id);
  async function click() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    try {
      setError("");
      await toggle(car.id);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <button
        className={"heart " + (saved ? "saved" : "")}
        aria-label={`${saved ? "Убрать из избранного" : "Добавить в избранное"} ${car.brand} ${car.model}`}
        aria-pressed={saved}
        disabled={saving}
        onClick={click}
      >
        {saved ? "♥" : "♡"}
      </button>
      {error && (
        <span className="favorite-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
export function Layout({ children }) {
  const { user, logout } = useAuth(),
    { favorites } = useCatalog(),
    { pathname } = useLocation(),
    navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    window.scrollTo(0, 0);
    setError("");
  }, [pathname]);
  async function signout() {
    try {
      await logout();
      navigate("/");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="demo">
        Учебный автосалон · демонстрационный каталог · заявки сохраняются на
        сервере
      </div>
      <header>
        <Link className="logo" to="/">
          ala<span>auto</span>
          <i>●</i>
        </Link>
        <nav aria-label="Основная навигация">
          <Link className={pathname === "/" ? "active" : ""} to="/">
            Автомобили
          </Link>
          <Link
            className={pathname === "/favorites" ? "active" : ""}
            to="/favorites"
          >
            Избранное <small>{favorites.length}</small>
          </Link>
          <Link
            className={pathname === "/bookings" ? "active" : ""}
            to="/bookings"
          >
            Мои заявки
          </Link>
          {user?.role === "admin" && (
            <Link className={pathname === "/admin" ? "active" : ""} to="/admin">
              Управление
            </Link>
          )}
        </nav>
        <div className="account-nav">
          {user ? (
            <>
              <Link to="/profile" className="account-chip">
                <span>{user.name.slice(0, 1).toUpperCase()}</span>
                {user.name.split(" ")[0]}
              </Link>
              <button className="logout" onClick={signout}>
                Выйти
              </button>
            </>
          ) : (
            <Link className="login-link" to="/login">
              Войти ↗
            </Link>
          )}
        </div>
      </header>
      <main>
        <ErrorBox message={error} />
        {children}
      </main>
      <footer>
        <Link className="logo" to="/">
          ala<span>auto</span>
          <i>●</i>
        </Link>
        <span>Ваш путь начинается с выбора.</span>
        <small>© 2026 AlaAuto · React + Go</small>
      </footer>
    </>
  );
}
