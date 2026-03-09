import axios from 'axios';
import { normalizeLeadInfoFromMeta, getFinalLeadScore } from '../intelligence/leadScoring.js';
import { sendLeadToZoho } from './zohoCRM.js';

const CONFIG = {
  verifyToken: process.env.META_VERIFY_TOKEN || '',
  accessToken: process.env.META_ACCESS_TOKEN || '',
  apiVersion: process.env.META_GRAPH_VERSION || 'v22.0',
  maxRetries: 3,
  retryDelayMs: 5000,
  fakeLeadId: '444444444444'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMetaError(error) {
  const metaError = error?.response?.data?.error || null;

  return {
    raw: error?.response?.data || error?.message || 'unknown_error',
    message: metaError?.message || error?.message || 'unknown_error',
    code: metaError?.code || null,
    subcode: metaError?.error_subcode || null,
    type: metaError?.type || null,
    fbtrace_id: metaError?.fbtrace_id || null
  };
}

function isPermissionError(parsedError) {
  return (
    parsedError.code === 100 ||
    parsedError.code === 200 ||
    parsedError.subcode === 33
  );
}

function isRetryableError(parsedError) {
  if (!parsedError) return false;
  if (isPermissionError(parsedError)) return false;

  return true;
}

export function registerMetaRoutes(app, runtime, addAudit) {
  // =====================================================
  // VERIFY WEBHOOK
  // =====================================================
  app.get('/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔎 [META VERIFY] mode:', mode);
    console.log('🔎 [META VERIFY] token_match:', token === CONFIG.verifyToken);

    if (mode === 'subscribe' && token === CONFIG.verifyToken) {
      addAudit('meta_webhook_verified');
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  });

  // =====================================================
  // RECEIVE LEAD EVENT
  // =====================================================
  app.post('/webhook/meta', async (req, res) => {
    // Meta exige respuesta rápida
    res.sendStatus(200);

    console.log('📩 [META RAW BODY]:', JSON.stringify(req.body, null, 2));

    const change = req.body?.entry?.[0]?.changes?.[0]?.value || null;

    if (!change) {
      console.warn('⚠️ [META] Body sin change.value');
      addAudit('meta_event_without_change', {
        body: req.body
      });
      return;
    }

    const {
      leadgen_id: leadId = null,
      form_id: formId = null,
      page_id: pageId = null
    } = change;

    console.log('🧪 [META EXTRACTED]', { leadId, formId, pageId });

    if (!leadId) {
      console.warn('⚠️ [META] Evento sin leadId');
      addAudit('meta_event_without_lead', {
        formId,
        pageId
      });
      return;
    }

    if (leadId === CONFIG.fakeLeadId) {
      console.warn('⚠️ [META] Lead fake de prueba detectado');
      addAudit('meta_fake_test_lead', {
        leadId,
        formId,
        pageId
      });
      return;
    }

    if (!CONFIG.accessToken) {
      console.error('❌ [META] Falta META_ACCESS_TOKEN');
      addAudit('meta_missing_token', {
        leadId,
        formId,
        pageId
      });
      return;
    }

    console.log(`🚀 [META] Iniciando proceso para Lead ID: ${leadId}`);

    const fetchLeadData = async (attempt = 1) => {
      try {
        const { data } = await axios.get(
          `https://graph.facebook.com/${CONFIG.apiVersion}/${leadId}`,
          {
            params: {
              access_token: CONFIG.accessToken,
              fields: 'id,created_time,ad_id,form_id,page_id,field_data'
            },
            timeout: 15000
          }
        );

        console.log(`✅ [META GRAPH] Lead recuperado en intento ${attempt}`);
        return data;
      } catch (error) {
        const parsed = parseMetaError(error);

        console.error(`❌ [META GRAPH ERROR] intento ${attempt}:`, JSON.stringify(parsed, null, 2));

        if (isPermissionError(parsed)) {
          throw new Error(`MISSING_PERMISSIONS: ${parsed.message}`);
        }

        if (attempt < CONFIG.maxRetries && isRetryableError(parsed)) {
          console.log(`🔄 [META] Reintento ${attempt}/${CONFIG.maxRetries - 1} en ${CONFIG.retryDelayMs}ms...`);
          await sleep(CONFIG.retryDelayMs);
          return fetchLeadData(attempt + 1);
        }

        throw new Error(`META_GRAPH_FAILED: ${parsed.message}`);
      }
    };

    try {
      // 1. Recuperar lead real
      const rawData = await fetchLeadData();

      console.log('📥 [META GRAPH RESPONSE]:', JSON.stringify(rawData, null, 2));

      // 2. Normalizar
      const leadInfo = normalizeLeadInfoFromMeta(rawData);

      console.log('🧾 [LEAD NORMALIZED]:', JSON.stringify(leadInfo, null, 2));

      // 3. Scoring
      const score = await getFinalLeadScore(axios, leadInfo);

      console.log('🧠 [LEAD SCORE]:', JSON.stringify(score, null, 2));

      // 4. CRM
      const zoho = await sendLeadToZoho(axios, leadInfo, score);

      console.log('📦 [ZOHO RESULT]:', JSON.stringify(zoho, null, 2));

      // 5. Métricas
      runtime.metrics.metaLeads += 1;
      if (score.clase === 'VIP') {
        runtime.metrics.vipLeads += 1;
      }

      // 6. Auditoría
      addAudit('meta_lead_success', {
        leadId,
        formId,
        pageId,
        score: score.clase,
        scoreValue: score.score,
        zohoOk: zoho.ok
      });

      console.log(`🏁 [META] Lead ${leadId} procesado correctamente.`);
    } catch (error) {
      console.error('❌ [META FATAL]:', error.message);

      addAudit('meta_lead_error', {
        leadId,
        formId,
        pageId,
        error: error.message
      });
    }
  });
}
