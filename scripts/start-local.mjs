import { spawn } from "node:child_process";
import { openSync, closeSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5178";
function printAddresses() {
  console.log(`На компьютере: http://127.0.0.1:5178\nМобильное превью: http://127.0.0.1:5178/mobile.html`);
  const addresses = Object.entries(networkInterfaces()).filter(([name]) => !/^(utun|tun|tap|lo)/.test(name)).flatMap(([, values]) => values).filter((n) => n.family === "IPv4" && !n.internal);
  for (const n of addresses) console.log(`На телефоне в той же сети: http://${n.address}:5178`);
}
try {
  const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
  const html = await r.text();
  if (html.includes("ВТБ Смарт-сделка")) {
    console.log(`Уже запущено: ${url}`);
    printAddresses();
    process.exit(0);
  }
  throw new Error("Порт 5178 занят другим приложением.");
} catch (e) {
  if (e.message.includes("занят")) throw e;
}
if (!existsSync(`${root}/dist/index.html`))
  throw new Error("Сначала выполните npm run build");
const log = openSync(`${root}/server.log`, "a");
const child = spawn(
  process.execPath,
  [
    `${root}/node_modules/vite/bin/vite.js`,
    "preview",
    "--host",
    "0.0.0.0",
    "--port",
    "5178",
    "--strictPort",
  ],
  { cwd: root, stdio: ["ignore", log, log], detached: true },
);
child.unref();
closeSync(log);
writeFileSync(`${root}/.local-server.pid`, String(child.pid));
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try {
    const r = await fetch(url);
    if (r.ok) {
      console.log(`Прототип запущен: ${url}\nPID: ${child.pid}`);
      printAddresses();
      process.exit(0);
    }
  } catch {}
}
throw new Error("Не удалось запустить сервер. Проверьте server.log.");
