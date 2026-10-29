/**
 * Turns "write the whole store to disk" into something safe to call on every
 * change. Only one write runs at a time, and any changes made while it runs
 * are folded into a single follow-up write of the latest state, instead of
 * one full rewrite per change. That matters on a cloud-storage-backed disk,
 * where the same object can only be replaced about once a second, so a burst
 * of changes (a bulk import) would otherwise fail writes and lose data.
 *
 * The returned promise resolves once the state at the time of the call has
 * been written.
 */
export function createCoalescedWriter(write: () => Promise<void>): () => Promise<void> {
  let dirty = false;
  let running: Promise<void> | null = null;

  async function flush(): Promise<void> {
    try {
      while (dirty) {
        dirty = false;
        await write();
      }
    } finally {
      // Cleared in the same tick the loop exits, so a save() can never land
      // between "nothing left to write" and "no longer running" and be dropped.
      running = null;
    }
  }

  return function save(): Promise<void> {
    dirty = true;
    if (!running) running = flush();
    return running;
  };
}
