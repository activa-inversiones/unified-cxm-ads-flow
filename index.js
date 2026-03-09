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
  version: '7.3.0',
  startedAt: new Date().toISOString(),
  maturity: {
    adsIntegration: 82,
    backendCXM: 88,
    crmAutomation: 92,
    socialListening: 35,
    competitiveRadar: 25,
    commandCenter: 55
  },
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
    maturity: runtime.maturity,
    metrics: runtime.metrics,
    modules: runtime.modules,
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
