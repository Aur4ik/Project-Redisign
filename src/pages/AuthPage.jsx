import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ErrorBox } from "../components/UI";
export default function AuthPage({ register = false }) {
  const { user, authenticate, error: connectionError } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const from = location.state?.from;
  const destination =
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !["/login", "/register"].includes(from)
      ? from
      : "/profile";
  if (user) return <Navigate to={destination} replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await authenticate(register ? "register" : "login", data);
      navigate(destination, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-layout">
      <div className="auth-story">
        <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
        <h1>
          Хороший выбор
          <br />
          начинается
          <br />
          <em>с вас.</em>
        </h1>
        <p>
          Ваши автомобили, ваши планы.
          <br />
          Сохраните понравившиеся варианты
          <br />и запишитесь на тест-драйв.
        </p>
        <div className="auth-badge">
          A<span>↗</span>
        </div>
      </div>
      <div className="form-panel auth-form">
        <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ В ALAAUTO</p>
        <h2>{register ? "Создать аккаунт" : "С возвращением"}</h2>
        <p>
          {register
            ? "Пара деталей — и можно выбирать свой автомобиль."
            : "Войдите, чтобы продолжить свой маршрут."}
        </p>
        <ErrorBox message={error || connectionError} />
        <form onSubmit={submit}>
          {register && (
            <label>
              Ваше имя
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                placeholder="Как к вам обращаться?"
              />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              required
              minLength={register ? 8 : 1}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "Не менее 8 символов" : "Ваш пароль"}
            />
          </label>
          {register && (
            <p className="muted">
              Создаётся учебный аккаунт. Заявки и избранное будут храниться на
              сервере проекта.
            </p>
          )}
          <button disabled={busy} className="primary">
            {busy
              ? "Подождите…"
              : register
                ? "Создать аккаунт ↗"
                : "Войти в аккаунт ↗"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
          <Link state={location.state} to={register ? "/login" : "/register"}>
            {register ? "Войти" : "Зарегистрироваться"}
          </Link>
        </p>
      </div>
    </section>
  );
}
