import { csvBlob, xlsxBlob, reportFiles } from "./export.js";
// Persistent upload snapshots ensure a resumed session always uses identical bytes.
export class DriveSync {
  constructor(store, drive, save, snapshot = build => build()) { this.store = store; this.drive = drive; this.save = save; this.snapshot = snapshot; this.busy = null; }
  run(job, { force = false, final = false } = {}) {
    if (this.busy) return this.busy.then(() => force ? this.run(job, { force, final }) : undefined);
    this.busy = this.sync(job, { force, final }).finally(() => { this.busy = null; });
    return this.busy;
  }
  async file(job, name, blob, folder, revision) {
    const key = `${job.key}:${name}`;
    let row = await this.store.get("uploads", key) || { key, job: job.key };
    if (row.blob) await this.sendFile(row, name, folder);
    row = { ...row, blob, session: null, revision };
    await this.store.put("uploads", row);
    await this.sendFile(row, name, folder);
  }
  async sendFile(row, name, folder) {
    const result = await this.drive.upload(name.split("/").pop(), row.blob, folder, () => {}, row.session, async session => { row.session = session; await this.store.put("uploads", row); }, row.id);
    if (!result.id) throw new Error("Upload não confirmou o identificador do arquivo.");
    row.id = result.id; row.blob = null; row.session = null;
    await this.store.put("uploads", row);
  }
  async sync(job, { force, final }) {
    if (!job.driveFolder) return;
    if (job.driveAccount && this.drive.account !== job.driveAccount) throw new Error("Reconecte à conta que criou a pasta desta coleta.");
    const started = Date.now();
    let uploaded = 0, mediaError = null;
    for await (const row of this.store.records("media", job.key)) {
      if (!row.complete || row.driveId) continue;
      try {
        if (!row.blob) throw new Error("Mídia pendente sem cópia local; consulte o diagnóstico.");
        const result = await this.drive.upload(row.path.split("/").pop(), row.blob, job.driveMediaFolder, () => {}, row.uploadSession, async session => { row.uploadSession = session; await this.store.put("media", row); });
        if (!result.id) throw new Error("Drive não confirmou a mídia.");
        row.driveId = result.id; row.uploadSession = null; row.uploadError = null;
        if (job.options.releaseUploadedMedia) { row.blob = null; row.localReleased = true; }
        await this.store.put("media", row);
        job.pendingUploads = Math.max(0, (job.pendingUploads || 0) - 1);
        if (row.localReleased) job.localBytes = Math.max(0, (job.localBytes || 0) - row.size);
        job.revision = (job.revision || 0) + 1;
        await this.save();
      } catch (error) {
        row.uploadError = error.message; await this.store.put("media", row);
        mediaError = error; break; // Preserve the media queue, but still try updating the spreadsheet.
      }
      // Do not starve CSV updates while a busy channel keeps adding media.
      if (!force && (++uploaded >= 20 || Date.now() - started >= 20000)) break;
    }
    if (!force && (job.syncedRevision === (job.revision || 0) || Date.now() - (job.lastSyncAttempt || 0) < 60000)) { if (mediaError) throw mediaError; return; }
    job.lastSyncAttempt = Date.now();
    if (!job.driveSystemFolder) { job.driveSystemFolder = (await this.drive.folder(".system", job.driveFolder)).id; await this.save(); }
    // Snapshot callback briefly freezes collector writes for a consistent corpus.
    const { revision, files } = await this.snapshot(async () => {
      const revision = job.revision || 0, report = await reportFiles(this.store, job);
      const files = [["mensagens.csv", await csvBlob(this.store, job), job.driveFolder], ["indice_midias.json", report.index, job.driveSystemFolder], ["relatorio_coleta.json", report.report, job.driveSystemFolder]];
      if (job.options.workbook) files.push(["workbook.xlsx", await xlsxBlob(this.store, job), job.driveFolder]);
      return { revision, files };
    });
    for (const [name, blob, folder] of files) await this.file(job, name, blob, folder, revision);
    job.syncedRevision = revision; job.lastSync = new Date().toISOString(); job.uploadNotice = mediaError?.message || "";
    await this.save();
    if (mediaError) throw mediaError;
  }
}
