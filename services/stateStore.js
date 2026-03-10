// services/stateStore.js
// Persistencia local JSON para ACTIVA Unified CXM
// Node 18+ | ESM

import fs from "fs/promises";
import path from "path";

const DEFAULT_STATE = {
  app: "ACTIVA Unified CXM",
  version: "7.7.0",
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, extra) {
  const out = { ...base };
  for (const key of Object.keys(extra || {})) {
    const baseVal = out[key];
    const extraVal = extra[key];
    if (isPlainObject(baseVal) && isPlainObject(extraVal)) {
      out[key] = deepMerge(baseVal, extraVal);
    } else {
      out[key] = extraVal;
    }
  }
  return out;
}

class StateStore {
  constructor() {
    this.filePath =
      process.env.STATE_FILE_PATH ||
      path.join(process.cwd(), "data", "runtime-state.json");

    this.maxAuditEntries = Number(process.env.MAX_AUDIT_ENTRIES || 500);
    this.maxLeadEntries = Number(process.env.MAX_LEAD_ENTRIES || 1000);

    this.state = clone(DEFAULT_STATE);
    this._saveTimer = null;
    this._isSaving = false;
    this._pendingSave = false;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = deepMerge(clone(DEFAULT_STATE), parsed);
      this.state.updatedAt = new Date().toISOString();
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
    return clone(this.state);
  }

  getDashboardSummary() {
    return {
      app: this.state.app,
      version: this.state.version,
      maturity: this.state.maturity,
      metrics: this.state.metrics,
      modules: this.state.modules,
      goals: this.state.goals,
      audit: this.state.audit.slice(0, 20),
      updatedAt: this.state.updatedAt,
      counts: {
        audit: this.state.audit.length,
        leads: this.state.leads.length,
        dedupeKeys: Object.keys(this.state.dedupeRegistry).length,
        socialAuthors: Object.keys(this.state.socialAuthors).length,
        radarKeywords: Object.keys(this.state.radarKeywords).length,
      },
    };
  }

  getMetrics() {
    return clone(this.state.metrics);
  }

  incrementMetric(metricName, value = 1) {
    if (typeof this.state.metrics[metricName] !== "number") {
      this.state.metrics[metricName] = 0;
    }
    this.state.metrics[metricName] += Number(value || 0);
    this.touch();
    this.scheduleSave();
    return this.state.metrics[metricName];
  }

  setMetric(metricName, value) {
    this.state.metrics[metricName] = Number(value || 0);
    this.touch();
    this.scheduleSave();
    return this.state.metrics[metricName];
  }

  addAudit(entry = {}) {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.state.audit.unshift(item);
    if (this.state.audit.length > this.maxAuditEntries) {
      this.state.audit = this.state.audit.slice(0, this.maxAuditEntries);
    }

    this.touch();
    this.scheduleSave();
    return item;
  }

  addLead(lead = {}) {
    const item = {
      id: lead.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      receivedAt: new Date().toISOString(),
      ...lead,
    };

    this.state.leads.unshift(item);
    if (this.state.leads.length > this.maxLeadEntries) {
      this.state.leads = this.state.leads.slice(0, this.maxLeadEntries);
    }

    this.touch();
    this.scheduleSave();
    return item;
  }

  hasDedupeKey(key) {
    return Boolean(this.state.dedupeRegistry[key]);
  }

  setDedupeKey(key, value = true) {
    if (!key) return;
    this.state.dedupeRegistry[key] = value;
    this.touch();
    this.scheduleSave();
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
    this.touch();
    this.scheduleSave();

    return this.state.socialAuthors[authorKey].mentions;
  }

  registerRadarKeyword(keyword, payload = {}) {
    if (!keyword) return;

    if (!this.state.radarKeywords[keyword]) {
      this.state.radarKeywords[keyword] = {
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        snapshots: [],
      };
    }

    this.state.radarKeywords[keyword].snapshots.unshift({
      timestamp: new Date().toISOString(),
      ...payload,
    });

    if (this.state.radarKeywords[keyword].snapshots.length > 50) {
      this.state.radarKeywords[keyword].snapshots =
        this.state.radarKeywords[keyword].snapshots.slice(0, 50);
    }

    this.state.radarKeywords[keyword].lastSeenAt = new Date().toISOString();
    this.touch();
    this.scheduleSave();
  }

  async replaceState(nextState = {}) {
    this.state = deepMerge(clone(DEFAULT_STATE), nextState);
    this.touch();
    await this.saveNow();
    return this.getState();
  }

  touch() {
    this.state.updatedAt = new Date().toISOString();
  }

  scheduleSave(delayMs = 700) {
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
      this.touch();
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

const stateStore = new StateStore();

export default stateStore;
export { StateStore };
