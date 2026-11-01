const database = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open("vtb-smart-deal-files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function storeFile(file) {
  const db = await database(),
    id = crypto.randomUUID();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return { id, name: file.name, size: file.size, type: file.type };
}
export async function readFile(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction("files").objectStore("files").get(id);
    r.onsuccess = () => {
      db.close();
      resolve(r.result);
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
export async function downloadFile(file) {
  if (!file.id) return;
  const blob = await readFile(file.id);
  if (!blob) return;
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
