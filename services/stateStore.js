// services/stateStore.js
// ESM - Node 18+
// Persistencia local JSON con API lista para enchufar después a Firestore si quieres.

import fs from "fs/promises";
import path from "path";

const DEFAULT_STATE = {
  metrics: {
    metaLeads: 0,
    googleConversions: 0,
    tiktokEvents: 0,
    googleLeadForms: 0,
    webForms: 0,
    vipLeads: 0,
    socialMentions: 0,
    socialUniqueAuthors: 0,
  },
  maturity: {
    adsIntegration: 83,
    backendCXM: 90,
    crmAutomation: 65,
    socialListening: 20,
    competitiveRadar: 20,
    commandCenter: 100,
  },
  modules: {
    metaAds: "active",
    googleAds: "active",
    tiktokAds: "active",
    googleLeadForms: "active",
    webForms: "active",
    zohoCRM: "active",
    leadScoring: "active",
    socialListening: "partial",
    competitiveRadar: "partial",
    commandCenter: "active",
  },
  goals: {
    socialAuthorsTarget: 1000,
    firstMetaLeadTarget: 1,
    firstGoogleConversionTarget: 1,
    firstTikTokEventTarget: 1,
    firstGoogleLeadTarget: 1,
    firstWebLeadTarget: 1,
  },
  audit: [],
  dedupeRegistry: {},
  leads: [],
  socialAuthors: {},
  radarKeywords: {},
  lastUpdatedAt: null,
  version: "1.0.0",
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
  const output = { ...target };
  if (!source || typeof source !== "object") return output;

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      output[key] = mergeDeep(targetValue, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  }

  return output;
}

export class StateStore {
  constructor(options = {}) {
    this.filePath =
      options.filePath ||
      process.env.STATE_FILE_PATH ||
      path.join(process.cwd(), "data", "runtime-state.json");

    this.maxAuditEntries = Number(process.env.MAX_AUDIT_ENTRIES || 500);
    this.maxLeadEntries = Number(process.env.MAX_LEAD_ENTRIES || 1000);

    this.state = deepClone(DEFAULT_STATE);

    this._saveTimer = null;
    this._isSaving = false;
    this._pendingSave = false;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = mergeDeep(deepClone(DEFAULT_STATE), parsed);
      this.state.lastUpdatedAt = new Date().toISOString();
      console.log(`[stateStore] Estado restaurado desde ${this.filePath}`);
    } catch (error) {
      if (error.code === "ENOENT") {
        await this.saveNow();
        console.log(`[stateStore] Estado inicial creado en ${this.filePath}`);
      } else {
        console.error("[stateStore] Error leyendo estado:", error.message);
        throw error;
      }
    }

    return this.getState();
  }

  getState() {
    return deepClone(this.state);
  }

  getMetrics() {
    return deepClone(this.state.metrics);
  }

  getAudit() {
    return deepClone(this.state.audit);
  }

  getDedupeRegistry() {
    return deepClone(this.state.dedupeRegistry);
  }

  getLeads() {
    return deepClone(this.state.leads);
  }

  getSocialAuthors() {
    return deepClone(this.state.socialAuthors);
  }

  getRadarKeywords() {
    return deepClone(this.state.radarKeywords);
  }

  async replaceState(nextState = {}) {
    this.state = mergeDeep(deepClone(DEFAULT_STATE), nextState);
    this.state.lastUpdatedAt = new Date().toISOString();
    await this.saveNow();
    return this.getState();
  }

  async patchState(partial = {}) {
    this.state = mergeDeep(this.state, partial);
    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();
    return this.getState();
  }

  incrementMetric(metricName, value = 1) {
    if (typeof this.state.metrics[metricName] !== "number") {
      this.state.metrics[metricName] = 0;
    }

    this.state.metrics[metricName] += value;
    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();

    return this.state.metrics[metricName];
  }

  setMetric(metricName, value) {
    this.state.metrics[metricName] = Number(value || 0);
    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();

    return this.state.metrics[metricName];
  }

  addAudit(entry = {}) {
    const safeEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.state.audit.unshift(safeEntry);

    if (this.state.audit.length > this.maxAuditEntries) {
      this.state.audit = this.state.audit.slice(0, this.maxAuditEntries);
    }

    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();

    return safeEntry;
  }

  addLead(lead = {}) {
    const safeLead = {
      id: lead.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      receivedAt: new Date().toISOString(),
      ...lead,
    };

    this.state.leads.unshift(safeLead);

    if (this.state.leads.length > this.maxLeadEntries) {
      this.state.leads = this.state.leads.slice(0, this.maxLeadEntries);
    }

    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();

    return safeLead;
  }

  setDedupeKey(key, value = true) {
    if (!key) return;
    this.state.dedupeRegistry[key] = value;
    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  hasDedupeKey(key) {
    return Boolean(this.state.dedupeRegistry[key]);
  }

  registerSocialAuthor(authorKey) {
    if (!authorKey) return 0;

    if (!this.state.socialAuthors[authorKey]) {
      this.state.socialAuthors[authorKey] = {
        firstSeenAt: new Date().toISOString(),
        mentions: 0,
      };
      this.incrementMetric("socialUniqueAuthors", 1);
    }

    this.state.socialAuthors[authorKey].mentions += 1;
    this.state.socialAuthors[authorKey].lastSeenAt = new Date().toISOString();
    this.incrementMetric("socialMentions", 1);

    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();

    return this.state.socialAuthors[authorKey].mentions;
  }

  registerRadarKeyword(keyword, payload = {}) {
    if (!keyword) return;

    if (!this.state.radarKeywords[keyword]) {
      this.state.radarKeywords[keyword] = {
        firstSeenAt: new Date().toISOString(),
        snapshots: [],
      };
    }

    this.state.radarKeywords[keyword].snapshots.unshift({
      timestamp: new Date().toISOString(),
      ...payload,
    });

    this.state.radarKeywords[keyword].lastSeenAt = new Date().toISOString();

    if (this.state.radarKeywords[keyword].snapshots.length > 50) {
      this.state.radarKeywords[keyword].snapshots =
        this.state.radarKeywords[keyword].snapshots.slice(0, 50);
    }

    this.state.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  getDashboardSummary() {
    return {
      app: "ACTIVA Unified CXM",
      version: this.state.version,
      maturity: this.state.maturity,
      metrics: this.state.metrics,
      modules: this.state.modules,
      goals: this.state.goals,
      audit: this.state.audit.slice(0, 20),
      updatedAt: this.state.lastUpdatedAt,
      counts: {
        audit: this.state.audit.length,
        leads: this.state.leads.length,
        dedupeKeys: Object.keys(this.state.dedupeRegistry).length,
        socialAuthors: Object.keys(this.state.socialAuthors).length,
        radarKeywords: Object.keys(this.state.radarKeywords).length,
      },
    };
  }

  scheduleSave(delayMs = 800) {
    if (this._saveTimer) clearTimeout(this._saveTimer);

    this._saveTimer = setTimeout(() => {
      this.saveNow().catch((error) => {
        console.error("[stateStore] Error guardando estado:", error.message);
      });
    }, delayMs);
  }

  async saveNow() {
    if (this._isSaving) {
      this._pendingSave = true;
      return;
    }

    this._isSaving = true;

    try {
      this.state.lastUpdatedAt = new Date().toISOString();

      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(
        this.filePath,
        JSON.stringify(this.state, null, 2),
        "utf8"
      );
    } finally {
      this._isSaving = false;

      if (this._pendingSave) {
        this._pendingSave = false;
        await this.saveNow();
      }
    }
  }
}

export const stateStore = new StateStore();
export default stateStore;
