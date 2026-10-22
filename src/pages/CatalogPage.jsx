import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext";
import { CarVisual, ErrorBox, FavoriteButton, Loading } from "../components/UI";
import { money } from "../api/client";
export default function CatalogPage({ onlyFavorites = false }) {
  const { cars, favorites, loading, error, reload } = useCatalog();
  const [q, setQ] = useState(""),
    [brand, setBrand] = useState(""),
    [body, setBody] = useState(""),
    [budget, setBudget] = useState(""),
    [sort, setSort] = useState("default");
  function reset() {
    setQ("");
    setBrand("");
    setBody("");
    setBudget("");
    setSort("default");
  }
  const filtered = cars
    .filter(
      (c) =>
        (!onlyFavorites || favorites.includes(c.id)) &&
        `${c.brand} ${c.model}`.toLowerCase().includes(q.toLowerCase()) &&
        (!brand || c.brand === brand) &&
        (!body || c.body === body) &&
        (!budget || c.price <= Number(budget)),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : sort === "new"
            ? b.year - a.year
            : a.id - b.id,
    );
  const featured = cars[0];
  if (loading) return <Loading />;
  if (error)
    return (
      <section className="page-heading">
        <ErrorBox message={error} />
        <button className="primary" onClick={reload}>
          Повторить загрузку ↻
        </button>
      </section>
    );
  return (
    <>
      {!onlyFavorites && featured ? (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">ВАШ СЛЕДУЮЩИЙ ПОВОРОТ</p>
              <h1>
                Новая глава.
                <br />
                <em>Ваш автомобиль.</em>
              </h1>
              <p className="intro">
                Найдите автомобиль под свой ритм жизни.
                <br />
                Выберите свой — мы сохраним время для знакомства.
              </p>
              <a className="primary" href="#inventory">
                Подобрать автомобиль <span>↗</span>
              </a>
              <div className="hero-bottom">
                <span>01 / {String(cars.length).padStart(2, "0")}</span>
                <span>ВЫБИРАЙТЕ. СОХРАНЯЙТЕ. ПРОБУЙТЕ.</span>
              </div>
            </div>
            <div className="hero-art">
              <span className="outline-word">DRIVE</span>
              <CarVisual car={featured} hero />
              <Link to={"/cars/" + featured.id} className="hero-caption">
                <span>
                  {featured.brand} {featured.model}
                  <small>
                    {featured.year} · {featured.engine} · Автомат
                  </small>
                </span>
                <strong>{money(featured.price)} ↗</strong>
              </Link>
            </div>
          </section>
          <div className="trust-strip">
            <span>
              <b>01</b> Подбор под ваш бюджет
            </span>
            <span>
              <b>02</b> Все характеристики рядом
            </span>
            <span>
              <b>03</b> Запись в удобное время
            </span>
          </div>
        </>
      ) : (
        <section className="page-heading">
          <p className="eyebrow">
            {onlyFavorites ? "ВАША КОЛЛЕКЦИЯ" : "КАТАЛОГ АВТОСАЛОНА"}
          </p>
          <h1>{onlyFavorites ? "Избранное" : "Автомобили"}</h1>
          <p>
            {onlyFavorites
              ? "Сохранённые машины привязаны к вашему аккаунту."
              : "Каталог обновляется администратором."}
          </p>
        </section>
      )}
      <section id="inventory" className="inventory">
        <div className="section-title">
          <div>
            <p className="eyebrow">НАЙДИТЕ СВОЙ ВАРИАНТ</p>
            <h2>
              {onlyFavorites
                ? "Сохранённые автомобили"
                : "Автомобили в каталоге"}{" "}
              <span>{filtered.length}</span>
            </h2>
          </div>
          <label className="sort">
            Сортировка
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="default">По умолчанию</option>
              <option value="low">Сначала дешевле</option>
              <option value="high">Сначала дороже</option>
              <option value="new">Сначала новее</option>
            </select>
          </label>
        </div>
        <div className="filters">
          <label>
            Поиск
            <input
              placeholder="Марка или модель"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label>
            Марка
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Все марки</option>
              {[...new Set(cars.map((c) => c.brand))].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Кузов
            <select value={body} onChange={(e) => setBody(e.target.value)}>
              <option value="">Любой кузов</option>
              {[...new Set(cars.map((c) => c.body))].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Бюджет
            <select value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="">Любая цена</option>
              <option value="10000000">До 10 млн ₸</option>
              <option value="15000000">До 15 млн ₸</option>
              <option value="20000000">До 20 млн ₸</option>
              <option value="25000000">До 25 млн ₸</option>
            </select>
          </label>
          <button className="reset" onClick={reset}>
            Сбросить ↺
          </button>
        </div>
        {filtered.length ? (
          <div className="grid">
            {filtered.map((car) => (
              <article className="card" key={car.id}>
                <div className="car-image">
                  <span className="tag">{car.tag || "В наличии"}</span>
                  <FavoriteButton car={car} />
                  <Link
                    className="art-button"
                    to={"/cars/" + car.id}
                    aria-label={`Подробнее о ${car.brand} ${car.model}`}
                  >
                    <CarVisual car={car} />
                  </Link>
                </div>
                <div className="card-content">
                  <p className="car-meta">
                    {car.year} <span>•</span> {car.mileage.toLocaleString("ru")}{" "}
                    км <span>•</span> {car.body}
                  </p>
                  <h3>
                    <Link to={"/cars/" + car.id}>
                      {car.brand} {car.model}
                    </Link>
                  </h3>
                  <p className="spec-line">
                    {car.engine} / {car.fuel} / Автомат
                  </p>
                  <div className="card-bottom">
                    <strong>{money(car.price)}</strong>
                    <Link
                      className="arrow"
                      aria-label={`Открыть ${car.brand} ${car.model}`}
                      to={"/cars/" + car.id}
                    >
                      ↗
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>
              {onlyFavorites && !favorites.length
                ? "Пока ничего не сохранено"
                : "Подходящих машин не найдено"}
            </h3>
            <p>
              {onlyFavorites && !favorites.length
                ? "Нажмите на сердечко в карточке автомобиля."
                : "Измените фильтры или вернитесь позже — каталог может обновляться."}
            </p>
            {onlyFavorites ? (
              <Link className="primary" to="/">
                К каталогу ↗
              </Link>
            ) : (
              <button className="primary" onClick={reset}>
                Сбросить фильтры ↺
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
