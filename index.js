import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { registerMetaRoutes } from './services/metaAds.js';
import { registerGoogleRoutes } from './services/googleAds.js';
import { registerTikTokRoutes } from './services/tiktokAds.js';
import { registerSocialListeningRoutes } from './intelligence/socialListening.js';
import { registerCompetitiveRadarRoutes } from './intelligence/competitiveRadar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// APP CONFIG
// =====================================================
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// =====================================================
// SIMPLE RUNTIME STATE
// =====================================================
const runtime = {
  appName: 'ACTIVA Unified CXM',
  version: '7.5.0',
  startedAt: new Date().toISOString(),

  metrics: {
    metaLeads: 0,
    googleConversions: 0,
    tiktokEvents: 0,
    vipLeads: 0,
    socialMentions: 0,
    socialUniqueAuthors: 0
  },

  modules: {
    metaAds: 'active',
    googleAds: 'active',
    tiktokAds: 'active',
    zohoCRM: 'active',
    leadScoring: 'active',
    socialListening: 'partial',
    competitiveRadar: 'partial',
    commandCenter: 'active'
  },

  goals: {
    socialAuthorsTarget: 1000,
    firstMetaLeadTarget: 1,
    firstGoogleConversionTarget: 1,
    firstTikTokEventTarget: 1
  },

  audit: [],
  _socialAuthors: new Set()
};

function addAudit(type, detail = {}) {
  runtime.audit.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    detail,
    createdAt: new Date().toISOString()
  });

  runtime.audit = runtime.audit.slice(0, 200);
}

function points(condition, value) {
  return condition ? value : 0;
}

function hasAuditType(prefixes = []) {
  return runtime.audit.some((item) =>
    prefixes.some((prefix) => item.type.startsWith(prefix))
  );
}

function clamp100(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function progressTowardsTarget(current, target, maxPoints) {
  if (!target || target <= 0) return 0;
  return Math.min(maxPoints, (current / target) * maxPoints);
}

function calculateMaturity(state) {
  // -----------------------------------------------------
  // ADS INTEGRATION
  // Meta + Google + TikTok conectados + primeras señales reales
  // -----------------------------------------------------
  let adsIntegration = 0;
  adsIntegration += points(state.modules.metaAds === 'active', 25);
  adsIntegration += points(state.modules.googleAds === 'active', 20);
  adsIntegration += points(state.modules.tiktokAds === 'active', 20);

  adsIntegration += points(
    hasAuditType(['meta_', 'google_', 'tiktok_']),
    10
  );

  adsIntegration += progressTowardsTarget(
    state.metrics.metaLeads,
    state.goals.firstMetaLeadTarget,
    10
  );

  adsIntegration += progressTowardsTarget(
    state.metrics.googleConversions,
    state.goals.firstGoogleConversionTarget,
    8
  );

  adsIntegration += progressTowardsTarget(
    state.metrics.tiktokEvents,
    state.goals.firstTikTokEventTarget,
    7
  );

  // -----------------------------------------------------
  // BACKEND CXM
  // Backend vivo, auditoría, módulos registrados, endpoints operativos
  // -----------------------------------------------------
  let backendCXM = 0;
  backendCXM += points(state.modules.commandCenter === 'active', 20);
  backendCXM += points(state.audit.length > 0, 15);
  backendCXM += points(state.modules.metaAds === 'active', 15);
  backendCXM += points(state.modules.googleAds === 'active', 10);
  backendCXM += points(state.modules.tiktokAds === 'active', 10);
  backendCXM += points(state.modules.socialListening !== 'pending', 10);
  backendCXM += points(state.modules.competitiveRadar !== 'pending', 10);
  backendCXM += points(state.audit.length >= 5, 10);

  // -----------------------------------------------------
  // CRM AUTOMATION
  // Zoho + scoring + flujo real de lead
  // -----------------------------------------------------
  let crmAutomation = 0;
  crmAutomation += points(state.modules.zohoCRM === 'active', 35);
  crmAutomation += points(state.modules.leadScoring === 'active', 25);
  crmAutomation += points(hasAuditType(['meta_lead_success']), 20);
  crmAutomation += progressTowardsTarget(
    state.metrics.metaLeads,
    state.goals.firstMetaLeadTarget,
    10
  );
  crmAutomation += points(state.metrics.vipLeads > 0, 10);

  // -----------------------------------------------------
  // SOCIAL LISTENING
  // Endpoint listo + menciones + autores únicos
  // -----------------------------------------------------
  let socialListening = 0;
  socialListening += points(state.modules.socialListening !== 'pending', 20);
  socialListening += points(hasAuditType(['social_mention_']), 20);
  socialListening += progressTowardsTarget(state.metrics.socialMentions, 10, 20);
  socialListening += progressTowardsTarget(
    state.metrics.socialUniqueAuthors,
    state.goals.socialAuthorsTarget,
    40
  );

  // -----------------------------------------------------
  // COMPETITIVE RADAR
  // Endpoint + keywords registradas + algo de actividad real
  // -----------------------------------------------------
  let competitiveRadar = 0;
  competitiveRadar += points(state.modules.competitiveRadar !== 'pending', 20);
  competitiveRadar += points(hasAuditType(['competitive_radar_']), 30);
  competitiveRadar += points(state.audit.length >= 10, 10);
  competitiveRadar += progressTowardsTarget(state.metrics.socialMentions, 10, 10);
  competitiveRadar += progressTowardsTarget(state.metrics.socialUniqueAuthors, 100, 30);

  // -----------------------------------------------------
  // COMMAND CENTER
  // Vista central, módulos conectados, métricas visibles, auditoría viva
  // -----------------------------------------------------
  let commandCenter = 0;
  commandCenter += points(state.modules.commandCenter === 'active', 25);
  commandCenter += points(state.audit.length > 0, 15);
  commandCenter += points(state.modules.metaAds === 'active', 10);
  commandCenter += points(state.modules.googleAds === 'active', 10);
  commandCenter += points(state.modules.tiktokAds === 'active', 10);
  commandCenter += points(state.modules.socialListening !== 'pending', 10);
  commandCenter += points(state.modules.competitiveRadar !== 'pending', 10);
  commandCenter += points(state.metrics.metaLeads > 0, 5);
  commandCenter += points(
    state.metrics.googleConversions > 0 || state.metrics.tiktokEvents > 0,
    5
  );

  return {
    adsIntegration: clamp100(adsIntegration),
    backendCXM: clamp100(backendCXM),
    crmAutomation: clamp100(crmAutomation),
    socialListening: clamp100(socialListening),
    competitiveRadar: clamp100(competitiveRadar),
    commandCenter: clamp100(commandCenter)
  };
}

// =====================================================
// ROOT + HEALTH + DASHBOARD
// =====================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    app: runtime.appName,
    version: runtime.version,
    startedAt: runtime.startedAt,
    now: new Date().toISOString()
  });
});

app.get('/api/dashboard/summary', (req, res) => {
  res.json({
    app: runtime.appName,
    version: runtime.version,
    maturity: calculateMaturity(runtime),
    metrics: runtime.metrics,
    modules: runtime.modules,
    goals: runtime.goals,
    audit: runtime.audit
  });
});

// =====================================================
// REGISTER MODULES
// =====================================================
registerMetaRoutes(app, runtime, addAudit);
registerGoogleRoutes(app, runtime, addAudit);
registerTikTokRoutes(app, runtime, addAudit);
registerSocialListeningRoutes(app, runtime, addAudit);
registerCompetitiveRadarRoutes(app, runtime, addAudit);

// =====================================================
// FALLBACK
// =====================================================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// =====================================================
// START
// =====================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================');
  console.log('ACTIVA UNIFIED CXM PLATFORM');
  console.log(`PORT: ${PORT}`);
  console.log('ROOT: /');
  console.log('HEALTH: /health');
  console.log('DASHBOARD API: /api/dashboard/summary');
  console.log('==========================================');

  addAudit('system_start', {
    port: PORT
  });
});
