import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, money, today, maxDate } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CarVisual, ErrorBox, FavoriteButton, Loading } from "../components/UI";
export default function CarPage({ booking = false }) {
  const { id } = useParams(),
    { user } = useAuth(),
    navigate = useNavigate();
  const [car, setCar] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [success, setSuccess] = useState(false),
    [date, setDate] = useState(today()),
    [times, setTimes] = useState([]),
    [clock, setClock] = useState(""),
    [slotsLoading, setSlotsLoading] = useState(false),
    [slotError, setSlotError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setCar(null);
    setSuccess(false);
    setError("");
    api("/cars/" + id)
      .then((v) => {
        if (live) setCar(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, booking]);
  useEffect(() => {
    if (!booking) return;
    let live = true;
    setTimes([]);
    setClock("");
    setSlotError("");
    setSlotsLoading(true);
    api(`/cars/${id}/availability?date=${encodeURIComponent(date)}`)
      .then((v) => {
        if (live) {
          setTimes(v);
          setClock(v[0] || "");
        }
      })
      .catch((e) => {
        if (live) setSlotError(e.message);
      })
      .finally(() => {
        if (live) setSlotsLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, date, booking, retry]);
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/bookings", {
        method: "POST",
        body: {
          ...values,
          carId: Number(id),
          consent: values.consent === "on",
        },
      });
      setSuccess(true);
    } catch (e) {
      setError(e.message);
      if (e.status === 401)
        navigate("/login", { state: { from: `/cars/${id}/test-drive` } });
      if (e.status === 409) setRetry((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <Loading />;
  if (!car)
    return (
      <section className="empty">
        <h2>Автомобиль недоступен</h2>
        <ErrorBox message={error} />
        <Link to="/" className="primary">
          К каталогу ↗
        </Link>
      </section>
    );
  if (booking)
    return (
      <>
        <Link className="back" to={"/cars/" + id}>
          ← К автомобилю
        </Link>
        <section className="booking-layout">
          <div>
            <p className="eyebrow">ПОЗНАКОМЬТЕСЬ БЛИЖЕ</p>
            <h1>
              Почувствуйте
              <br />
              свою машину.
            </h1>
            <p>
              Тест-драйв {car.brand} {car.model}
            </p>
            <CarVisual car={car} />
            <p className="muted">
              Все времена указаны по Казахстану (UTC+5). Выберите свободный слот
              на ближайшие 90 дней. В учебном проекте заявки обрабатываются
              администратором, реальный автосалон их не получает.
            </p>
          </div>
          <div className="form-panel">
            {success ? (
              <div role="status">
                <span className="success-icon">✓</span>
                <h2>Заявка принята</h2>
                <p>
                  Заявка сохранена на сервере. Администратор сможет подтвердить
                  её; следить за статусом можно в личном кабинете.
                </p>
                <Link className="primary" to="/bookings">
                  Мои заявки ↗
                </Link>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2>Запись на тест-драйв</h2>
                <ErrorBox message={error} />
                <label>
                  Ваше имя
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    defaultValue={user?.name}
                  />
                </label>
                <label>
                  Телефон
                  <input
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+7 700 123 45 67"
                    maxLength={24}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Дата
                    <input
                      name="date"
                      type="date"
                      min={today()}
                      max={maxDate()}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Время (UTC+5)
                    <select
                      name="time"
                      value={clock}
                      onChange={(e) => setClock(e.target.value)}
                      required
                      disabled={slotsLoading || !times.length}
                    >
                      {slotsLoading ? (
                        <option value="">Загружаем…</option>
                      ) : !times.length ? (
                        <option value="">Нет свободного времени</option>
                      ) : (
                        times.map((t) => <option key={t}>{t}</option>)
                      )}
                    </select>
                  </label>
                </div>
                <ErrorBox message={slotError} />
                {slotError && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setRetry((v) => v + 1)}
                  >
                    Повторить загрузку времени
                  </button>
                )}
                {!slotsLoading && !times.length && !slotError && (
                  <p className="muted">
                    На эту дату нет свободных слотов. Выберите другой день.
                  </p>
                )}
                <label className="check">
                  <input name="consent" type="checkbox" required />
                  Разрешаю сохранить имя и телефон в базе учебного проекта для
                  обработки заявки.
                </label>
                <button
                  className="primary"
                  type="submit"
                  disabled={
                    saving || slotsLoading || !times.length || !!slotError
                  }
                >
                  {saving ? "Сохраняем…" : "Отправить заявку ↗"}
                </button>
              </form>
            )}
          </div>
        </section>
      </>
    );
  return (
    <>
      <Link className="back" to="/">
        ← Все автомобили
      </Link>
      <section className="detail">
        <div className="detail-visual">
          <CarVisual car={car} />
          <p>
            {car.image
              ? "Изображение из карточки автомобиля"
              : "Схематичная иллюстрация · не фотография модели"}
          </p>
        </div>
        <div>
          <p className="eyebrow">АВТОМОБИЛЬ ИЗ КАТАЛОГА</p>
          <h1>
            {car.brand}
            <br />
            {car.model}
          </h1>
          <p className="detail-price">{money(car.price)}</p>
          <p>{car.description}</p>
          <dl>
            {Object.entries({
              Год: car.year,
              Пробег: `${car.mileage.toLocaleString("ru")} км`,
              Двигатель: `${car.engine} · ${car.power} л.с.`,
              Коробка: "Автомат",
              Привод: car.drive,
              Кузов: car.body,
              Топливо: car.fuel,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <Link className="primary" to={"/cars/" + id + "/test-drive"}>
            Записаться на тест-драйв ↗
          </Link>
          <div className="detail-favorite">
            <FavoriteButton car={car} />
            <span>Сохранить автомобиль в избранное</span>
          </div>
        </div>
      </section>
    </>
  );
}
