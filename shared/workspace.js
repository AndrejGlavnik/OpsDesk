(function () {
  const workspaceKey = "andrej-operations-workspace-v2";
  const legacyOpsDeskKey = "opsdesk-workspace-v1";

  function now() {
    return new Date().toISOString();
  }

  function emptySyncDesk() {
    return {
      applications: [],
      connections: [],
      datasets: [],
      fields: [],
      calculations: [],
      changes: [],
      discrepancies: []
    };
  }

  function emptyWorkspace() {
    const timestamp = now();
    return {
      app: "Andrej Operations Workspace",
      schemaVersion: 2,
      meta: { createdAt: timestamp, updatedAt: timestamp },
      opsDesk: { items: [], preferences: {} },
      syncDesk: emptySyncDesk()
    };
  }

  function normalizeWorkspace(value) {
    const base = emptyWorkspace();

    if (value?.app === "OpsDesk" || Array.isArray(value?.items)) {
      base.opsDesk.items = Array.isArray(value.items) ? value.items : [];
      base.opsDesk.preferences = value.preferences || {};
      if (value.exportedAt) base.meta.updatedAt = value.exportedAt;
      return base;
    }

    if (!value || typeof value !== "object") return base;
    const syncDesk = value.syncDesk || {};
    return {
      app: "Andrej Operations Workspace",
      schemaVersion: 2,
      meta: {
        createdAt: value.meta?.createdAt || base.meta.createdAt,
        updatedAt: value.meta?.updatedAt || value.exportedAt || base.meta.updatedAt
      },
      opsDesk: {
        items: Array.isArray(value.opsDesk?.items) ? value.opsDesk.items : [],
        preferences: value.opsDesk?.preferences || {}
      },
      syncDesk: Object.fromEntries(
        Object.keys(base.syncDesk).map((key) => [key, Array.isArray(syncDesk[key]) ? syncDesk[key] : []])
      )
    };
  }

  function readRaw(key) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? null : JSON.parse(value);
    } catch {
      return null;
    }
  }

  function save(workspace) {
    const normalized = normalizeWorkspace(workspace);
    normalized.meta.updatedAt = now();
    try {
      localStorage.setItem(workspaceKey, JSON.stringify(normalized));
      return normalized;
    } catch {
      return normalized;
    }
  }

  function get() {
    const stored = readRaw(workspaceKey);
    if (stored) return normalizeWorkspace(stored);

    const legacy = readRaw(legacyOpsDeskKey);
    if (legacy) return save(normalizeWorkspace(legacy));
    return emptyWorkspace();
  }

  function mergeRecords(current, incoming) {
    const merged = new Map((current || []).map((record) => [record.id, record]));
    (incoming || []).forEach((record) => merged.set(record.id, record));
    return [...merged.values()];
  }

  function merge(currentValue, incomingValue) {
    const current = normalizeWorkspace(currentValue);
    const incoming = normalizeWorkspace(incomingValue);
    const syncDesk = {};
    Object.keys(current.syncDesk).forEach((key) => {
      syncDesk[key] = mergeRecords(current.syncDesk[key], incoming.syncDesk[key]);
    });
    return normalizeWorkspace({
      ...current,
      opsDesk: {
        items: mergeRecords(current.opsDesk.items, incoming.opsDesk.items),
        preferences: { ...current.opsDesk.preferences, ...incoming.opsDesk.preferences }
      },
      syncDesk
    });
  }

  function exportPayload(workspace = get()) {
    const normalized = normalizeWorkspace(workspace);
    return {
      ...normalized,
      exportedAt: now()
    };
  }

  globalThis.WorkspaceStore = {
    key: workspaceKey,
    legacyOpsDeskKey,
    empty: emptyWorkspace,
    emptySyncDesk,
    normalize: normalizeWorkspace,
    get,
    save,
    merge,
    exportPayload
  };
})();
