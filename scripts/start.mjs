import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      if (process.platform === "win32")
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      else child.kill("SIGTERM");
    }
  }
  process.exitCode = code;
}
function watch(child) {
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code || 0));
  return child;
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
console.log(
  "Запускаем Go API. Первая компиляция может занять несколько минут…",
);
watch(
  spawn("go", ["run", "./cmd/server"], {
    cwd: root + "backend",
    stdio: "inherit",
    env: process.env,
  }),
);
const deadline = Date.now() + 300000;
let ready = false;
while (!stopping && Date.now() < deadline) {
  try {
    const response = await fetch("http://127.0.0.1:8081/api/health", {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok && (await response.json()).status === "ok") {
      ready = true;
      break;
    }
  } catch {
    /* The compiler or database may still be starting. */
  }
  await delay(750);
}
if (!stopping && !ready) {
  console.error(
    "API не запустился за 5 минут. Проверьте сообщения Go и свободный порт 8081.",
  );
  stop(1);
}
if (!stopping && ready) {
  watch(
    spawn(
      process.execPath,
      [
        root + "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5173",
        "--strictPort",
      ],
      { cwd: root, stdio: "inherit", env: process.env },
    ),
  );
  console.log("AlaAuto: http://127.0.0.1:5173 · Go API: http://127.0.0.1:8081");
}
