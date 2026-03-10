import express from "express";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import stateStore from "./services/stateStore.js";

import { registerMetaRoutes } from "./services/metaAds.js";
import { registerGoogleRoutes } from "./services/googleAds.js";
import { registerTikTokRoutes } from "./services/tiktokAds.js";
import { registerGoogleLeadFormRoutes } from "./services/googleLeadForms.js";
import { registerWebFormRoutes } from "./services/webForms.js";
import { registerSocialListeningRoutes } from "./intelligence/socialListening.js";
import { registerCompetitiveRadarRoutes } from "./intelligence/competitiveRadar.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

const SAVE_INTERVAL_MS = Number(process.env.RUNTIME_SAVE_INTERVAL_MS || 15000);
const MAX_AUDIT_ENTRIES = Number(process.env.MAX_AUDIT_ENTRIES || 500);
const DASHBOARD_AUDIT_LIMIT = Number(process.env.DASHBOARD_AUDIT_LIMIT || 50);
const JSON_LIMIT = process.env.JSON_LIMIT || "10mb";
const URLENCODED_LIMIT = process.env.URLENCODED_LIMIT || "10mb";

app.disable("x-powered-by");
app.set("trust proxy", true);

// =====================================================
// INTERNAL OPERATIONAL STATE
// =====================================================
const ops = {
  dirty: false,
  saving: false,
  shuttingDown: false,
  lastPersistAttemptAt: null,
  lastPersistSuccessAt: null,
  lastPersistError: null,
  saveTimer: null,
  bootedAt: new Date().toISOString(),
};

// =====================================================
// HELPERS
// =====================================================
function nowIso() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp100(value) {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value, 0))));
}

function points(condition, value) {
  return condition ? value : 0;
}

function progressTowardsTarget(current, target, maxPoints) {
  const safeCurrent = safeNumber(current, 0);
  const safeTarget = safeNumber(target, 0);

  if (!safeTarget || safeTarget <= 0) return 0;
  return Math.min(maxPoints, (safeCurrent / safeTarget) * maxPoints);
}

function serializeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Error desconocido",
    stack: error?.stack || null,
  };
}

function sanitizeAuditDetail(detail = {}) {
  if (!detail || typeof detail !== "object") return { value: detail };

  const cloned = {};
  for (const [key, value] of Object.entries(detail)) {
    if (value instanceof Error) {
      cloned[key] = serializeError(value);
    } else if (typeof value === "bigint") {
      cloned[key] = String(value);
    } else {
      cloned[key] = value;
    }
  }
  return cloned;
}

function hasAuditType(runtime, prefixes = []) {
  return runtime.audit.some((item) =>
    prefixes.some((prefix) => String(item.type || "").startsWith(prefix))
  );
}

function calculateMaturity(state) {
  let adsIntegration = 0;
  adsIntegration += points(state.modules.metaAds === "active", 18);
  adsIntegration += points(state.modules.googleAds === "active", 12);
  adsIntegration += points(state.modules.tiktokAds === "active", 12);
  adsIntegration += points(state.modules.googleLeadForms === "active", 10);
  adsIntegration += points(state.modules.webForms === "active", 10);

  adsIntegration += progressTowardsTarget(
    state.metrics.metaLeads,
    state.goals.firstMetaLeadTarget,
    8
  );
  adsIntegration += progressTowardsTarget(
    state.metrics.googleConversions,
    state.goals.firstGoogleConversionTarget,
    6
  );
  adsIntegration += progressTowardsTarget(
    state.metrics.tiktokEvents,
    state.goals.firstTikTokEventTarget,
    6
  );
  adsIntegration += progressTowardsTarget(
    state.metrics.googleLeadFormLeads,
    state.goals.firstGoogleLeadTarget,
    9
  );
  adsIntegration += progressTowardsTarget(
    state.metrics.webFormLeads,
    state.goals.firstWebLeadTarget,
    9
  );

  let backendCXM = 0;
  backendCXM += points(state.modules.commandCenter === "active", 18);
  backendCXM += points(state.audit.length > 0, 12);
  backendCXM += points(state.modules.metaAds === "active", 8);
  backendCXM += points(state.modules.googleAds === "active", 8);
  backendCXM += points(state.modules.tiktokAds === "active", 8);
  backendCXM += points(state.modules.googleLeadForms === "active", 8);
  backendCXM += points(state.modules.webForms === "active", 8);
  backendCXM += points(state.modules.socialListening !== "pending", 8);
  backendCXM += points(state.modules.competitiveRadar !== "pending", 8);
  backendCXM += points(state.audit.length >= 5, 14);

  let crmAutomation = 0;
  crmAutomation += points(state.modules.zohoCRM === "active", 25);
  crmAutomation += points(state.modules.leadScoring === "active", 20);
  crmAutomation += points(hasAuditType(state, ["crm_router_processed"]), 20);
  crmAutomation += points(hasAuditType(state, ["meta_lead_success"]), 10);
  crmAutomation += progressTowardsTarget(
    state.metrics.googleLeadFormLeads,
    state.goals.firstGoogleLeadTarget,
    8
  );
  crmAutomation += progressTowardsTarget(
    state.metrics.webFormLeads,
    state.goals.firstWebLeadTarget,
    8
  );
  crmAutomation += points(state.metrics.vipLeads > 0, 9);

  let socialListening = 0;
  socialListening += points(state.modules.socialListening !== "pending", 20);
  socialListening += points(hasAuditType(state, ["social_mention_"]), 20);
  socialListening += progressTowardsTarget(state.metrics.socialMentions, 10, 20);
  socialListening += progressTowardsTarget(
    state.metrics.socialUniqueAuthors,
    state.goals.socialAuthorsTarget,
    40
  );

  let competitiveRadar = 0;
  competitiveRadar += points(state.modules.competitiveRadar !== "pending", 20);
  competitiveRadar += points(hasAuditType(state, ["competitive_radar_"]), 30);
  competitiveRadar += points(state.audit.length >= 10, 10);
  competitiveRadar += progressTowardsTarget(state.metrics.socialMentions, 10, 10);
  competitiveRadar += progressTowardsTarget(
    state.metrics.socialUniqueAuthors,
    100,
    30
  );

  let commandCenter = 0;
  commandCenter += points(state.modules.commandCenter === "active", 18);
  commandCenter += points(state.audit.length > 0, 12);
  commandCenter += points(state.modules.metaAds === "active", 7);
  commandCenter += points(state.modules.googleAds === "active", 7);
  commandCenter += points(state.modules.tiktokAds === "active", 7);
  commandCenter += points(state.modules.googleLeadForms === "active", 7);
  commandCenter += points(state.modules.webForms === "active", 7);
  commandCenter += points(state.modules.socialListening !== "pending", 7);
  commandCenter += points(state.modules.competitiveRadar !== "pending", 7);
  commandCenter += points(state.metrics.metaLeads > 0, 4);
  commandCenter += points(state.metrics.googleConversions > 0, 4);
  commandCenter += points(state.metrics.tiktokEvents > 0, 4);
  commandCenter += points(state.metrics.googleLeadFormLeads > 0, 5);
  commandCenter += points(state.metrics.webFormLeads > 0, 5);

  return {
    adsIntegration: clamp100(adsIntegration),
    backendCXM: clamp100(backendCXM),
    crmAutomation: clamp100(crmAutomation),
    socialListening: clamp100(socialListening),
    competitiveRadar: clamp100(competitiveRadar),
    commandCenter: clamp100(commandCenter),
  };
}

function normalizeRuntimeState(state = {}) {
  const runtime = {
    appName: String(state.appName || "ACTIVA Unified CXM"),
    version: String(state.version || "8.0.0"),
    startedAt: state.startedAt || nowIso(),
    lastSavedAt: state.lastSavedAt || null,

    metrics: {
      metaLeads: safeNumber(state.metrics?.metaLeads, 0),
      googleConversions: safeNumber(state.metrics?.googleConversions, 0),
      tiktokEvents: safeNumber(state.metrics?.tiktokEvents, 0),
      googleLeadFormLeads: safeNumber(state.metrics?.googleLeadFormLeads, 0),
      webFormLeads: safeNumber(state.metrics?.webFormLeads, 0),
      vipLeads: safeNumber(state.metrics?.vipLeads, 0),
      socialMentions: safeNumber(state.metrics?.socialMentions, 0),
      socialUniqueAuthors: safeNumber(state.metrics?.socialUniqueAuthors, 0),
    },

    modules: {
      metaAds: state.modules?.metaAds || "active",
      googleAds: state.modules?.googleAds || "active",
      tiktokAds: state.modules?.tiktokAds || "active",
      googleLeadForms: state.modules?.googleLeadForms || "active",
      webForms: state.modules?.webForms || "active",
      zohoCRM: state.modules?.zohoCRM || "active",
      leadScoring: state.modules?.leadScoring || "active",
      socialListening: state.modules?.socialListening || "partial",
      competitiveRadar: state.modules?.competitiveRadar || "partial",
      commandCenter: state.modules?.commandCenter || "active",
    },

    goals: {
      socialAuthorsTarget: safeNumber(state.goals?.socialAuthorsTarget, 1000),
      firstMetaLeadTarget: safeNumber(state.goals?.firstMetaLeadTarget, 1),
      firstGoogleConversionTarget: safeNumber(state.goals?.firstGoogleConversionTarget, 1),
      firstTikTokEventTarget: safeNumber(state.goals?.firstTikTokEventTarget, 1),
      firstGoogleLeadTarget: safeNumber(state.goals?.firstGoogleLeadTarget, 1),
      firstWebLeadTarget: safeNumber(state.goals?.firstWebLeadTarget, 1),
    },

    audit: Array.isArray(state.audit) ? state.audit : [],
    _socialAuthors: new Set(
      Array.isArray(state._socialAuthors) ? state._socialAuthors : []
    ),
  };

  runtime.audit = runtime.audit.slice(0, MAX_AUDIT_ENTRIES);
  runtime.metrics.socialUniqueAuthors = runtime._socialAuthors.size;

  return runtime;
}

function snapshotRuntime(runtime) {
  return {
    appName: runtime.appName,
    version: runtime.version,
    startedAt: runtime.startedAt,
    lastSavedAt: runtime.lastSavedAt,

    metrics: { ...runtime.metrics },
    modules: { ...runtime.modules },
    goals: { ...runtime.goals },

    audit: runtime.audit.slice(0, MAX_AUDIT_ENTRIES),
    _socialAuthors: Array.from(runtime._socialAuthors),
  };
}

function markDirty() {
  ops.dirty = true;
}

function createTrackedSet(originalSet, onMutation) {
  const set = originalSet instanceof Set ? originalSet : new Set();

  return new Proxy(set, {
    get(target, prop, receiver) {
      if (prop === "add") {
        return (value) => {
          const sizeBefore = target.size;
          const result = target.add(value);
          if (target.size !== sizeBefore) onMutation();
          return receiver;
        };
      }

      if (prop === "delete") {
        return (value) => {
          const deleted = target.delete(value);
          if (deleted) onMutation();
          return deleted;
        };
      }

      if (prop === "clear") {
        return () => {
          if (target.size > 0) {
            target.clear();
            onMutation();
          }
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function trackObjectDeep(obj, onMutation) {
  if (!obj || typeof obj !== "object") return obj;

  if (obj instanceof Set) {
    return createTrackedSet(obj, onMutation);
  }

  Object.keys(obj).forEach((key) => {
    obj[key] = trackObjectDeep(obj[key], onMutation);
  });

  return new Proxy(obj, {
    set(target, prop, value) {
      target[prop] = trackObjectDeep(value, onMutation);
      onMutation();
      return true;
    },
    deleteProperty(target, prop) {
      const existed = Reflect.has(target, prop);
      const deleted = Reflect.deleteProperty(target, prop);
      if (existed && deleted) onMutation();
      return deleted;
    },
  });
}

function addAuditFactory(runtime) {
  return function addAudit(type, detail = {}, meta = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      type: String(type || "unknown"),
      detail: sanitizeAuditDetail(detail),
      level: meta.level || "info",
      module: meta.module || null,
      requestId: meta.requestId || null,
      createdAt: nowIso(),
    };

    runtime.audit.unshift(entry);
    runtime.audit = runtime.audit.slice(0, MAX_AUDIT_ENTRIES);
    markDirty();

    return entry;
  };
}

async function persistRuntime(runtime, force = false) {
  if (ops.saving) return false;
  if (!force && !ops.dirty) return false;

  ops.saving = true;
  ops.lastPersistAttemptAt = nowIso();

  try {
    const snapshot = snapshotRuntime(runtime);
    const saved = await stateStore.save(snapshot);

    runtime.lastSavedAt = saved.lastSavedAt || nowIso();
    ops.lastPersistSuccessAt = runtime.lastSavedAt;
    ops.lastPersistError = null;
    ops.dirty = false;

    return true;
  } catch (error) {
    ops.lastPersistError = serializeError(error);
    console.error("[persistRuntime] Error guardando estado:", error);
    return false;
  } finally {
    ops.saving = false;
  }
}

function schedulePeriodicPersistence(runtime) {
  if (ops.saveTimer) clearInterval(ops.saveTimer);

  ops.saveTimer = setInterval(() => {
    persistRuntime(runtime).catch((error) => {
      console.error("[schedulePeriodicPersistence] Error:", error);
    });
  }, SAVE_INTERVAL_MS);
}

function buildDashboardSummary(runtime) {
  return {
    app: runtime.appName,
    version: runtime.version,
    startedAt: runtime.startedAt,
    lastSavedAt: runtime.lastSavedAt,
    maturity: calculateMaturity(runtime),
    metrics: runtime.metrics,
    modules: runtime.modules,
    goals: runtime.goals,
    counts: {
      audit: runtime.audit.length,
      socialAuthors: runtime._socialAuthors.size,
    },
    ops: {
      bootedAt: ops.bootedAt,
      dirty: ops.dirty,
      saving: ops.saving,
      lastPersistAttemptAt: ops.lastPersistAttemptAt,
      lastPersistSuccessAt: ops.lastPersistSuccessAt,
      lastPersistError: ops.lastPersistError,
      stateFilePath: stateStore.getFilePath(),
    },
    audit: runtime.audit.slice(0, DASHBOARD_AUDIT_LIMIT),
  };
}

function installSecurityHeaders(appInstance) {
  appInstance.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

function installRequestContext(appInstance) {
  appInstance.use((req, res, next) => {
    req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
}

function installBodyParsers(appInstance) {
  appInstance.use(
    express.json({
      limit: JSON_LIMIT,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  appInstance.use(
    express.urlencoded({
      extended: true,
      limit: URLENCODED_LIMIT,
    })
  );
}

function installStaticFiles(appInstance) {
  appInstance.use(express.static(path.join(__dirname, "public")));

  // Compatibilidad opcional, no habilitar salvo necesidad real.
  if (String(process.env.ENABLE_LEGACY_STATIC_ROOT || "").toLowerCase() === "true") {
    appInstance.use(express.static(__dirname));
  }
}

async function gracefulShutdown(signal, runtime, addAudit) {
  if (ops.shuttingDown) return;
  ops.shuttingDown = true;

  console.log(`[shutdown] Señal recibida: ${signal}`);

  try {
    addAudit(
      "system_shutdown",
      {
        signal,
        savingBeforeExit: true,
      },
      { level: "warn", module: "system" }
    );

    await persistRuntime(runtime, true);
  } catch (error) {
    console.error("[shutdown] Error durante cierre:", error);
  } finally {
    if (ops.saveTimer) clearInterval(ops.saveTimer);
    process.exit(0);
  }
}

// =====================================================
// BOOTSTRAP
// =====================================================
async function bootstrap() {
  const loadedState = await stateStore.load();
  const baseRuntime = normalizeRuntimeState(loadedState);
  const runtime = trackObjectDeep(baseRuntime, markDirty);
  const addAudit = addAuditFactory(runtime);

  installSecurityHeaders(app);
  installRequestContext(app);
  installBodyParsers(app);
  installStaticFiles(app);

  // =====================================================
  // ROOT + HEALTH + DASHBOARD
  // =====================================================
  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      app: runtime.appName,
      version: runtime.version,
      startedAt: runtime.startedAt,
      now: nowIso(),
      uptimeSeconds: Math.round(process.uptime()),
      persistence: {
        stateFilePath: stateStore.getFilePath(),
        lastPersistSuccessAt: ops.lastPersistSuccessAt,
        lastPersistError: ops.lastPersistError,
        dirty: ops.dirty,
        saving: ops.saving,
      },
    });
  });

  app.get("/api/dashboard/summary", (_req, res) => {
    res.json(buildDashboardSummary(runtime));
  });

  app.get("/api/debug/runtime", (req, res) => {
    const providedKey =
      req.headers["x-debug-api-key"] ||
      req.query.key ||
      req.query.debugKey;

    const expectedKey = process.env.DEBUG_API_KEY;

    if (expectedKey && providedKey !== expectedKey) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized_debug_access",
        requestId: req.requestId,
      });
    }

    return res.json({
      ok: true,
      requestId: req.requestId,
      runtime: snapshotRuntime(runtime),
      ops,
    });
  });

  // =====================================================
  // REGISTER MODULES
  // =====================================================
  registerMetaRoutes(app, runtime, addAudit);
  registerGoogleRoutes(app, runtime, addAudit);
  registerTikTokRoutes(app, runtime, addAudit);
  registerGoogleLeadFormRoutes(app, runtime, addAudit);
  registerWebFormRoutes(app, runtime, addAudit);
  registerSocialListeningRoutes(app, runtime, addAudit);
  registerCompetitiveRadarRoutes(app, runtime, addAudit);

  // =====================================================
  // 404
  // =====================================================
  app.use((req, res) => {
    addAudit(
      "route_not_found",
      {
        method: req.method,
        path: req.originalUrl,
      },
      {
        level: "warn",
        module: "http",
        requestId: req.requestId,
      }
    );

    res.status(404).json({
      ok: false,
      error: "Ruta no encontrada",
      path: req.originalUrl,
      requestId: req.requestId,
    });
  });

  // =====================================================
  // ERROR HANDLER
  // =====================================================
  app.use((error, req, res, _next) => {
    console.error("[global_error_handler]", error);

    addAudit(
      "unhandled_route_error",
      {
        method: req?.method || null,
        path: req?.originalUrl || null,
        error: serializeError(error),
      },
      {
        level: "error",
        module: "http",
        requestId: req?.requestId || null,
      }
    );

    res.status(error?.statusCode || 500).json({
      ok: false,
      error: "internal_server_error",
      message: error?.message || "Error interno del servidor",
      requestId: req?.requestId || null,
    });
  });

  // =====================================================
  // SYSTEM START
  // =====================================================
  addAudit(
    "system_start",
    {
      port: PORT,
      stateFilePath: stateStore.getFilePath(),
      loadMeta: stateStore.getLastLoadMeta(),
      env: {
        nodeEnv: process.env.NODE_ENV || "undefined",
        legacyStaticRoot:
          String(process.env.ENABLE_LEGACY_STATIC_ROOT || "").toLowerCase() === "true",
        jsonLimit: JSON_LIMIT,
        urlencodedLimit: URLENCODED_LIMIT,
        saveIntervalMs: SAVE_INTERVAL_MS,
      },
    },
    {
      level: "info",
      module: "system",
    }
  );

  await persistRuntime(runtime, true);
  schedulePeriodicPersistence(runtime);

  process.on("SIGINT", () => gracefulShutdown("SIGINT", runtime, addAudit));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", runtime, addAudit));

  process.on("uncaughtException", async (error) => {
    console.error("[uncaughtException]", error);

    addAudit(
      "uncaught_exception",
      { error: serializeError(error) },
      { level: "error", module: "system" }
    );

    await persistRuntime(runtime, true);
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason) => {
    console.error("[unhandledRejection]", reason);

    addAudit(
      "unhandled_rejection",
      {
        reason:
          reason instanceof Error ? serializeError(reason) : { value: reason },
      },
      { level: "error", module: "system" }
    );

    await persistRuntime(runtime, true);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log("==========================================");
    console.log("ACTIVA UNIFIED CXM PLATFORM");
    console.log(`PORT: ${PORT}`);
    console.log("ROOT: /");
    console.log("HEALTH: /health");
    console.log("DASHBOARD API: /api/dashboard/summary");
    console.log("DEBUG API: /api/debug/runtime");
    console.log(`STATE FILE: ${stateStore.getFilePath()}`);
    console.log("==========================================");
  });
}

bootstrap().catch((error) => {
  console.error("[bootstrap] Error fatal de inicialización:", error);
  process.exit(1);
});
