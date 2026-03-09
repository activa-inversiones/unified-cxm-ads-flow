import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { registerMetaRoutes } from './services/metaAds.js';
import { registerGoogleRoutes } from './services/googleAds.js';
import { registerTikTokRoutes } from './services/tiktokAds.js';
import { registerGoogleLeadFormRoutes } from './services/googleLeadForms.js';
import { registerWebFormRoutes } from './services/webForms.js';
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
  version: '7.7.0',
  startedAt: new Date().toISOString(),

  metrics: {
    metaLeads: 0,
    googleConversions: 0,
    tiktokEvents: 0,
    googleLeadFormLeads: 0,
    webFormLeads: 0,
    vipLeads: 0,
    socialMentions: 0,
    socialUniqueAuthors: 0
  },

  modules: {
    metaAds: 'active',
    googleAds: 'active',
    tiktokAds: 'active',
    googleLeadForms: 'active',
    webForms: 'active',
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
    firstTikTokEventTarget: 1,
    firstGoogleLeadTarget: 1,
    firstWebLeadTarget: 1
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
  let adsIntegration = 0;
  adsIntegration += points(state.modules.metaAds === 'active', 18);
  adsIntegration += points(state.modules.googleAds === 'active', 12);
  adsIntegration += points(state.modules.tiktokAds === 'active', 12);
  adsIntegration += points(state.modules.googleLeadForms === 'active', 10);
  adsIntegration += points(state.modules.webForms === 'active', 10);

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
  backendCXM += points(state.modules.commandCenter === 'active', 18);
  backendCXM += points(state.audit.length > 0, 12);
  backendCXM += points(state.modules.metaAds === 'active', 8);
  backendCXM += points(state.modules.googleAds === 'active', 8);
  backendCXM += points(state.modules.tiktokAds === 'active', 8);
  backendCXM += points(state.modules.googleLeadForms === 'active', 8);
  backendCXM += points(state.modules.webForms === 'active', 8);
  backendCXM += points(state.modules.socialListening !== 'pending', 8);
  backendCXM += points(state.modules.competitiveRadar !== 'pending', 8);
  backendCXM += points(state.audit.length >= 5, 14);

  let crmAutomation = 0;
  crmAutomation += points(state.modules.zohoCRM === 'active', 25);
  crmAutomation += points(state.modules.leadScoring === 'active', 20);
  crmAutomation += points(hasAuditType(['crm_router_processed']), 20);
  crmAutomation += points(hasAuditType(['meta_lead_success']), 10);
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
  socialListening += points(state.modules.socialListening !== 'pending', 20);
  socialListening += points(hasAuditType(['social_mention_']), 20);
  socialListening += progressTowardsTarget(state.metrics.socialMentions, 10, 20);
  socialListening += progressTowardsTarget(
    state.metrics.socialUniqueAuthors,
    state.goals.socialAuthorsTarget,
    40
  );

  let competitiveRadar = 0;
  competitiveRadar += points(state.modules.competitiveRadar !== 'pending', 20);
  competitiveRadar += points(hasAuditType(['competitive_radar_']), 30);
  competitiveRadar += points(state.audit.length >= 10, 10);
  competitiveRadar += progressTowardsTarget(state.metrics.socialMentions, 10, 10);
  competitiveRadar += progressTowardsTarget(state.metrics.socialUniqueAuthors, 100, 30);

  let commandCenter = 0;
  commandCenter += points(state.modules.commandCenter === 'active', 18);
  commandCenter += points(state.audit.length > 0, 12);
  commandCenter += points(state.modules.metaAds === 'active', 7);
  commandCenter += points(state.modules.googleAds === 'active', 7);
  commandCenter += points(state.modules.tiktokAds === 'active', 7);
  commandCenter += points(state.modules.googleLeadForms === 'active', 7);
  commandCenter += points(state.modules.webForms === 'active', 7);
  commandCenter += points(state.modules.socialListening !== 'pending', 7);
  commandCenter += points(state.modules.competitiveRadar !== 'pending', 7);
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
registerGoogleLeadFormRoutes(app, runtime, addAudit);
registerWebFormRoutes(app, runtime, addAudit);
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
