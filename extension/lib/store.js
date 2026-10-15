const DB_NAME = "whatsapp-scoop-v1";
export class Store {
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 2);
      r.onupgradeneeded = () => {
        for (const name of ["jobs", "messages", "media", "uploads"]) {
          const s = r.result.objectStoreNames.contains(name) ? r.transaction.objectStore(name) : r.result.createObjectStore(name, { keyPath: "key" });
          if (name !== "jobs" && !s.indexNames.contains("job")) s.createIndex("job", "job");
          if (name === "messages" && !s.indexNames.contains("identity")) s.createIndex("identity", ["job", "message.id"]);
        }
      };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async transaction(name, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(name, mode), r = action(tx.objectStore(name));
      let value;
      if (r) { r.onsuccess = () => { value = r.result; }; r.onerror = () => reject(r.error); }
      tx.oncomplete = () => resolve(value); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error("Transação interrompida"));
    });
  }
  get(name, key) { return this.transaction(name, "readonly", s => s.get(key)); }
  put(name, value) { return this.transaction(name, "readwrite", s => s.put(value)); }
  all(name) { return this.transaction(name, "readonly", s => s.getAll()); }
  async page(name, job, after, limit = 100) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(name), result = [];
      const range = IDBKeyRange.bound(after || `${job}:`, `${job}:\uffff`, !!after, false);
      const req = tx.objectStore(name).openCursor(range);
      req.onsuccess = () => {
        const c = req.result;
        if (!c || result.length >= limit) { resolve(result); return; }
        result.push(c.value);
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }
  async *records(name, job) {
    let after;
    while (true) {
      const rows = await this.page(name, job, after, name !== "messages" ? 1 : 100);
      if (!rows.length) return;
      for (const row of rows) yield row;
      after = rows[rows.length - 1].key;
    }
  }
  findMessage(job, id) {
    return this.transaction("messages", "readonly", s => s.index("identity").get([job, id]));
  }
  replaceMessage(previousKey, record) {
    return this.transaction("messages", "readwrite", s => { if (previousKey && previousKey !== record.key) s.delete(previousKey); return s.put(record); });
  }
  async deleteJob(job) {
    for (const name of ["messages", "media", "uploads"]) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(name, "readwrite");
        const req = tx.objectStore(name).index("job").openCursor(IDBKeyRange.only(job));
        req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } };
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    }
    return this.transaction("jobs", "readwrite", s => s.delete(job));
  }
}
