import { spawn } from "node:child_process";
const input = process.argv.slice(2);
const args =
  input[0] === "--test"
    ? ["test", "./...", "-count=1"]
    : ["run", "./cmd/server", ...input];
const child = spawn("go", args, {
  cwd: new URL("../backend/", import.meta.url),
  stdio: "inherit",
  env: process.env,
});
child.on("error", () => {
  console.error("Go не найден. Установите Go 1.25 или новее.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
