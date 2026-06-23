import { collection, query, where, limit as fbLimit, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ARCHIVE_AFTER_MONTHS = 12;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 400;
const MAX_BATCHES_PER_RUN = 5;
const STORAGE_KEY = 'seyada_last_archive_run';

async function archiveOldDocs(sourceName, archiveName, cutoffTimestamp) {
  let batchesRun = 0;
  while (batchesRun < MAX_BATCHES_PER_RUN) {
    const snap = await getDocs(query(collection(db, sourceName), where('date', '<', cutoffTimestamp), fbLimit(BATCH_LIMIT)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.set(doc(db, archiveName, d.id), d.data());
      batch.delete(d.ref);
    });
    await batch.commit();
    batchesRun += 1;
    if (snap.docs.length < BATCH_LIMIT) break;
  }
}

// Call once after a successful login (fire-and-forget). There is no Cloud
// Function involved, so this only makes progress while someone has the app
// open — throttled to once a day so it doesn't re-scan on every page load.
export async function runAutoArchiveIfDue() {
  try {
    const lastRun = localStorage.getItem(STORAGE_KEY);
    if (lastRun && Date.now() - Number(lastRun) < CHECK_INTERVAL_MS) return;

    const cutoff = Timestamp.fromMillis(Date.now() - ARCHIVE_AFTER_MONTHS * 30 * 86400000);
    await archiveOldDocs('sales', 'sales_archive', cutoff);
    await archiveOldDocs('purchases', 'purchases_archive', cutoff);
    await archiveOldDocs('expenses', 'expenses_archive', cutoff);

    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch (e) {
    console.warn('auto-archive run failed', e);
  }
}
