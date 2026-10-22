import React, { useEffect, useState } from "react";
import { api, money, statusLabels } from "../api/client";
import { ErrorBox, Loading } from "../components/UI";
import { useCatalog } from "../context/CatalogContext";
const blankCar = {
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  price: "",
  mileage: 0,
  body: "Седан",
  fuel: "Бензин",
  engine: "2.0 л",
  power: 150,
  drive: "Передний",
  color: "#9baaa0",
  tag: "В наличии",
  description: "",
  image: "",
  active: true,
};
export default function AdminPage() {
  const { reload } = useCatalog();
  const [cars, setCars] = useState([]),
    [bookings, setBookings] = useState([]),
    [users, setUsers] = useState([]),
    [tab, setTab] = useState("cars"),
    [editing, setEditing] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [c, b, u] = await Promise.all([
        api("/admin/cars"),
        api("/admin/bookings"),
        api("/admin/users"),
      ]);
      setCars(c);
      setBookings(b);
      setUsers(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const values = {
      ...form,
      year: Number(form.year),
      price: Number(form.price),
      mileage: Number(form.mileage),
      power: Number(form.power),
      active: form.active === "on",
    };
    try {
      const updated = await api(
        "/admin/cars" + (editing.id ? "/" + editing.id : ""),
        { method: editing.id ? "PUT" : "POST", body: values },
      );
      setCars((old) =>
        editing.id
          ? old.map((c) => (c.id === updated.id ? updated : c))
          : [updated, ...old],
      );
      setEditing(null);
      setSuccess("Автомобиль сохранён в базе.");
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function archive(car) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/admin/cars/" + car.id, { method: "DELETE", body: {} });
      setCars((old) =>
        old.map((c) => (c.id === car.id ? { ...c, active: false } : c)),
      );
      setSuccess("Автомобиль в архиве. Его можно вернуть через редактор.");
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function status(id, next) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api("/admin/bookings/" + id + "/status", {
        method: "PATCH",
        body: { status: next },
      });
      setBookings((old) =>
        old.map((b) => (b.id === id ? { ...b, status: next } : b)),
      );
      setSuccess("Статус заявки обновлён.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-page">
      <div className="section-title">
        <div>
          <p className="eyebrow">ПАНЕЛЬ АДМИНИСТРАТОРА</p>
          <h1>
            Автосалон
            <br />
            под контролем.
          </h1>
        </div>
        <button className="secondary" onClick={load} disabled={loading || busy}>
          Обновить ↻
        </button>
      </div>
      <div className="stats">
        <div>
          <strong>{cars.filter((c) => c.active).length}</strong>
          <span>машин в каталоге</span>
        </div>
        <div>
          <strong>
            {bookings.filter((b) => b.status === "pending").length}
          </strong>
          <span>новых заявок</span>
        </div>
        <div>
          <strong>{users.length}</strong>
          <span>пользователей</span>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Разделы управления">
        {[
          ["cars", "Автомобили"],
          ["bookings", "Заявки"],
          ["users", "Пользователи"],
        ].map(([id, title]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "selected" : ""}
            key={id}
            onClick={() => {
              setTab(id);
              setEditing(null);
              setError("");
              setSuccess("");
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <ErrorBox message={error} />
      {success && (
        <p className="success-box" role="status">
          {success}
        </p>
      )}
      {loading ? (
        <Loading />
      ) : tab === "cars" ? (
        <>
          {editing ? (
            <div className="form-panel admin-editor">
              <div className="section-title">
                <h2>{editing.id ? "Редактирование" : "Новый автомобиль"}</h2>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Закрыть ×
                </button>
              </div>
              <form onSubmit={save} key={editing.id || "new"}>
                <div className="editor-grid">
                  {[
                    ["brand", "Марка", "text", {}],
                    ["model", "Модель", "text", {}],
                    [
                      "year",
                      "Год",
                      "number",
                      { min: 1950, max: new Date().getFullYear() + 1 },
                    ],
                    [
                      "price",
                      "Цена, ₸",
                      "number",
                      { min: 1, max: 10000000000 },
                    ],
                    [
                      "mileage",
                      "Пробег, км",
                      "number",
                      { min: 0, max: 2000000 },
                    ],
                    ["engine", "Двигатель", "text", {}],
                    [
                      "power",
                      "Мощность, л.с.",
                      "number",
                      { min: 1, max: 2000 },
                    ],
                    ["tag", "Метка", "text", { maxLength: 40 }],
                    ["color", "Цвет иллюстрации", "color", {}],
                  ].map(([name, label, type, extra]) => (
                    <label key={name}>
                      {label}
                      <input
                        type={type}
                        name={name}
                        defaultValue={editing[name]}
                        required={name !== "tag"}
                        {...extra}
                      />
                    </label>
                  ))}
                  {[
                    [
                      "body",
                      "Кузов",
                      [
                        "Седан",
                        "Кроссовер",
                        "Хэтчбек",
                        "Купе",
                        "Универсал",
                        "Пикап",
                      ],
                    ],
                    [
                      "fuel",
                      "Топливо",
                      ["Бензин", "Дизель", "Гибрид", "Электро"],
                    ],
                    ["drive", "Привод", ["Передний", "Задний", "Полный"]],
                  ].map(([name, label, options]) => (
                    <label key={name}>
                      {label}
                      <select name={name} defaultValue={editing[name]}>
                        {options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label>
                  Изображение — HTTPS-ссылка (необязательно)
                  <input
                    name="image"
                    type="url"
                    defaultValue={editing.image}
                    placeholder="https://…"
                    maxLength={2000}
                  />
                </label>
                <label>
                  Описание
                  <textarea
                    name="description"
                    defaultValue={editing.description}
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={editing.active}
                  />
                  Показывать в каталоге
                </label>
                <button disabled={busy} className="primary">
                  {busy ? "Сохраняем…" : "Сохранить автомобиль ↗"}
                </button>
              </form>
            </div>
          ) : (
            <button
              className="primary"
              onClick={() => {
                setEditing({ ...blankCar });
                setSuccess("");
              }}
            >
              Добавить автомобиль +
            </button>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Автомобиль</th>
                  <th>Цена</th>
                  <th>Состояние</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => (
                  <tr key={car.id}>
                    <td>
                      <strong>
                        {car.brand} {car.model}
                      </strong>
                      <small>
                        {car.year} · {car.mileage.toLocaleString("ru")} км
                      </small>
                    </td>
                    <td>{money(car.price)}</td>
                    <td>
                      <span
                        className={
                          "status " + (car.active ? "confirmed" : "cancelled")
                        }
                      >
                        {car.active ? "В каталоге" : "В архиве"}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button
                        disabled={busy}
                        onClick={() => {
                          setEditing({ ...car });
                          setSuccess("");
                          window.scrollTo({ top: 250, behavior: "smooth" });
                        }}
                      >
                        Изменить
                      </button>
                      {car.active && (
                        <button disabled={busy} onClick={() => archive(car)}>
                          В архив
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === "bookings" ? (
        bookings.length ? (
          <div className="admin-requests">
            {bookings.map((b) => (
              <article className="request" key={b.id}>
                <div>
                  <p className="eyebrow">
                    ЗАЯВКА #{b.id} · {b.date} · {b.time} UTC+5
                  </p>
                  <h3>
                    {b.car.brand} {b.car.model}
                  </h3>
                  <p>
                    {b.name} · {b.phone}
                  </p>
                  <p>{b.user.email}</p>
                  <span className={"status " + b.status}>
                    {statusLabels[b.status]}
                  </span>
                </div>
                <div className="request-actions">
                  {b.status === "pending" && (
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() => status(b.id, "confirmed")}
                    >
                      Подтвердить
                    </button>
                  )}
                  {b.status === "confirmed" && (
                    <button
                      disabled={busy}
                      className="primary"
                      onClick={() => status(b.id, "completed")}
                    >
                      Завершить
                    </button>
                  )}
                  {["pending", "confirmed"].includes(b.status) && (
                    <button
                      disabled={busy}
                      className="secondary"
                      onClick={() => status(b.id, "cancelled")}
                    >
                      Отменить
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>Заявок пока нет</h2>
            <p>Новые записи на тест-драйв появятся здесь.</p>
          </div>
        )
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Дата регистрации</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === "admin" ? "Администратор" : "Покупатель"}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
