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

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const runtime = {
  appName: 'ACTIVA Unified CXM',
  version: '7.4.0',
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

function calcProgressBySteps(current, steps = []) {
  let total = 0;
  for (const step of steps) {
    total += current >= step ? 1 : 0;
  }
  return Math.round((total / steps.length) * 100);
}

function calculateMaturity(runtime) {
  const adsIntegration =
    points(runtime.modules.metaAds === 'active', 30) +
    points(runtime.modules.googleAds === 'active', 25) +
    points(runtime.modules.tiktokAds === 'active', 25) +
    points(
      runtime.metrics.metaLeads > 0 ||
      runtime.metrics.googleConversions > 0 ||
      runtime.metrics.tiktokEvents > 0,
      20
    );

  const backendCXM =
    points(runtime.modules.commandCenter === 'active', 20) +
    points(runtime.modules.leadScoring === 'active', 20) +
    points(runtime.modules.zohoCRM === 'active', 20) +
    points(runtime.audit.length > 0, 20) +
    points(runtime.metrics.metaLeads >= 0, 20);

  const crmAutomation =
    points(runtime.modules.zohoCRM === 'active', 40) +
    points(runtime.modules.leadScoring === 'active', 20) +
    points(runtime.metrics.vipLeads >= 0, 10) +
    points(runtime.metrics.metaLeads > 0, 15) +
    points(runtime.audit.some(a => a.type === 'meta_lead_success'), 15);

  const socialListeningBase =
    points(runtime.modules.socialListening !== 'pending', 20) +
    points(runtime.metrics.socialMentions > 0, 20);

  const socialListeningGrowth = calcProgressBySteps(runtime.metrics.socialUniqueAuthors, [
    100, 300, 500, 1000
  ]);

  const socialListening = Math.min(
    100,
    socialListeningBase + Math.round(socialListeningGrowth * 0.6)
  );

  const competitiveRadar =
    points(runtime.modules.competitiveRadar !== 'pending', 25) +
    points(runtime.audit.some(a => a.type === 'competitive_radar_received'), 35) +
    points(runtime.audit.some(a => a.type === 'competitive_radar_error' || a.type === 'competitive_radar_invalid'), 10) +
    points(runtime.audit.length > 5, 10) +
    points(runtime.metrics.socialMentions > 0, 20);

  const commandCenter =
    points(runtime.modules.commandCenter === 'active', 25) +
    points(runtime.audit.length > 0, 15) +
    points(runtime.metrics.metaLeads >= 0, 10) +
    points(runtime.metrics.googleConversions >= 0, 10) +
    points(runtime.metrics.tiktokEvents >= 0, 10) +
    points(runtime.modules.socialListening !== 'pending', 15) +
    points(runtime.modules.competitiveRadar !== 'pending', 15);

  return {
    adsIntegration: Math.min(100, adsIntegration),
    backendCXM: Math.min(100, backendCXM),
    crmAutomation: Math.min(100, crmAutomation),
    socialListening: Math.min(100, socialListening),
    competitiveRadar: Math.min(100, competitiveRadar),
    commandCenter: Math.min(100, commandCenter)
  };
}

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

registerMetaRoutes(app, runtime, addAudit);
registerGoogleRoutes(app, runtime, addAudit);
registerTikTokRoutes(app, runtime, addAudit);
registerSocialListeningRoutes(app, runtime, addAudit);
registerCompetitiveRadarRoutes(app, runtime, addAudit);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================');
  console.log('ACTIVA UNIFIED CXM PLATFORM');
  console.log(`PORT: ${PORT}`);
  console.log('ROOT: /');
  console.log('HEALTH: /health');
  console.log('DASHBOARD API: /api/dashboard/summary');
  console.log('==========================================');

  addAudit('system_start', { port: PORT });
});
