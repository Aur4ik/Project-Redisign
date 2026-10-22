import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
export default function ProfilePage() {
  const { user, refresh } = useAuth(),
    { favorites } = useCatalog();
  return (
    <section className="profile-page">
      <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
      <h1>
        Рады видеть,
        <br />
        <em>{user.name}.</em>
      </h1>
      <div className="profile-grid">
        <div className="profile-card">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="status confirmed">
            {user.role === "admin" ? "Администратор" : "Покупатель"}
          </span>
          <button className="secondary" onClick={refresh}>
            Обновить профиль ↻
          </button>
        </div>
        <Link className="profile-card profile-link" to="/favorites">
          <span className="big-number">{favorites.length}</span>
          <h2>Избранное ↗</h2>
          <p>Ваш личный список автомобилей.</p>
        </Link>
        <Link className="profile-card profile-link" to="/bookings">
          <span className="big-number">↗</span>
          <h2>Мои тест-драйвы</h2>
          <p>Запланированные поездки и статусы заявок.</p>
        </Link>
      </div>
      {user.role === "admin" && (
        <Link className="primary" to="/admin">
          Перейти к управлению автосалоном ↗
        </Link>
      )}
    </section>
  );
}
