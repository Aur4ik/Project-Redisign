import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, statusLabels } from "../api/client";
import { ErrorBox, Loading } from "../components/UI";
export default function BookingsPage() {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(null);
  async function load() {
    setError("");
    setLoading(true);
    try {
      setItems(await api("/bookings"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function cancel(id) {
    setBusy(id);
    setError("");
    try {
      await api("/bookings/" + id, { method: "DELETE", body: {} });
      setItems((old) =>
        old.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="requests">
      <div className="section-title">
        <div>
          <p className="eyebrow">ВАШИ ПЛАНЫ</p>
          <h1>Мои заявки</h1>
        </div>
        <button className="secondary" disabled={loading} onClick={load}>
          Обновить ↻
        </button>
      </div>
      <p>Тест-драйвы и их текущие статусы. Часовой пояс UTC+5.</p>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : items.length ? (
        items.map((b) => (
          <article className="request" key={b.id}>
            <div className="request-car">
              <span className="request-number">
                #{String(b.id).padStart(3, "0")}
              </span>
              <h3>
                {b.car.brand} {b.car.model}
              </h3>
              <p>
                {new Date(b.date + "T12:00:00+05:00").toLocaleDateString(
                  "ru-RU",
                )}{" "}
                · {b.time}
              </p>
              <p>
                {b.name} · {b.phone}
              </p>
              <span className={"status " + b.status}>
                {statusLabels[b.status]}
              </span>
            </div>
            <div className="request-actions">
              {b.car.active && (
                <Link to={"/cars/" + b.carId}>Карточка машины ↗</Link>
              )}
              {["pending", "confirmed"].includes(b.status) && (
                <button
                  disabled={busy === b.id}
                  className="secondary"
                  onClick={() => cancel(b.id)}
                >
                  {busy === b.id ? "Отменяем…" : "Отменить заявку"}
                </button>
              )}
            </div>
          </article>
        ))
      ) : (
        !error && (
          <div className="empty">
            <h2>Впереди новый маршрут</h2>
            <p>Выберите автомобиль и запишитесь на первое знакомство.</p>
            <Link className="primary" to="/">
              Выбрать автомобиль ↗
            </Link>
          </div>
        )
      )}
    </section>
  );
}
