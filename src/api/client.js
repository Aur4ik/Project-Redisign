export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch("/api" + path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте запуск Go и подключение.");
  }
  let data = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      throw new Error("Сервер вернул некорректный ответ.");
    }
  }
  if (!response.ok) {
    const error = new Error(data?.error || "Не удалось выполнить запрос.");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const money = (value) =>
  new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
export const statusLabels = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
  completed: "Тест-драйв завершён",
  cancelled: "Отменена",
};
export function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty" }).format(
    new Date(),
  );
}
export function maxDate() {
  const date = new Date();
  date.setDate(date.getDate() + 89);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty" }).format(
    date,
  );
}
