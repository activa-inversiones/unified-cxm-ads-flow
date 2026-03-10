// services/stateStore.js
// Persistencia local JSON para ACTIVA Unified CXM
// Node 18+ | ESM

import fs from "fs/promises";
import path from "path";

const DEFAULT_RUNTIME_STATE = {
  appName: "ACTIVA Unified CXM",
  version: "8.0.0",
  startedAt: null,
  lastSavedAt: null,

  metrics: {
    metaLeads: 0,
    googleConversions: 0,
    tiktokEvents: 0,
    googleLeadFormLeads: 0,
    webFormLeads: 0,
    vipLeads: 0,
    socialMentions: 0,
    socialUniqueAuthors: 0,
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
  _socialAuthors: [],
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, extra) {
  const output = { ...base };

  for (const key of Object.keys(extra || {})) {
    const baseVal = output[key];
    const extraVal = extra[key];

    if (isPlainObject(baseVal) && isPlainObject(extraVal)) {
      output[key] = deepMerge(baseVal, extraVal);
    } else {
      output[key] = extraVal;
    }
  }

  return output;
}

class StateStore {
  constructor(options = {}) {
    this.filePath =
      options.filePath ||
      process.env.STATE_FILE_PATH ||
      path.join(process.cwd(), "data", "runtime-state.json");

    this.lastLoadMeta = {
      loaded: false,
      filePath: this.filePath,
      loadedAt: null,
      createdFresh: false,
    };
  }

  getFilePath() {
    return this.filePath;
  }

  getLastLoadMeta() {
    return { ...this.lastLoadMeta };
  }

  async load() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      const merged = deepMerge(deepClone(DEFAULT_RUNTIME_STATE), parsed);

      this.lastLoadMeta = {
        loaded: true,
        filePath: this.filePath,
        loadedAt: new Date().toISOString(),
        createdFresh: false,
      };

      return merged;
    } catch (error) {
      if (error.code === "ENOENT") {
        const fresh = deepClone(DEFAULT_RUNTIME_STATE);

        this.lastLoadMeta = {
          loaded: true,
          filePath: this.filePath,
          loadedAt: new Date().toISOString(),
          createdFresh: true,
        };

        await this.save(fresh);
        return fresh;
      }

      throw error;
    }
  }

  async save(state) {
    const serializable = deepClone(state);
    serializable.lastSavedAt = new Date().toISOString();

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(serializable, null, 2),
      "utf8"
    );

    return serializable;
  }
}

const stateStore = new StateStore();

export default stateStore;
export { StateStore, DEFAULT_RUNTIME_STATE };
