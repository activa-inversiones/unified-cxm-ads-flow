import axios from 'axios';
import { normalizeLeadInfoFromMeta } from '../intelligence/leadScoring.js';
import { processInboundLead } from './crmRouter.js';
import { sleep } from '../utils/helpers.js';

const CONFIG = {
  verifyToken: process.env.META_VERIFY_TOKEN || '',
  accessToken: process.env.META_ACCESS_TOKEN || '',
  apiVersion: process.env.META_GRAPH_VERSION || 'v22.0',
  maxRetries: 3,
  retryDelayMs: 5000,
  fakeLeadId: '444444444444'
};

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
  app.get('/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.verifyToken) {
      addAudit('meta_webhook_verified');
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  });

  app.post('/webhook/meta', async (req, res) => {
    res.sendStatus(200);

    const change = req.body?.entry?.[0]?.changes?.[0]?.value || null;

    if (!change) {
      addAudit('meta_event_without_change', { body: req.body });
      return;
    }

    const {
      leadgen_id: leadId = null,
      form_id: formId = null,
      page_id: pageId = null
    } = change;

    if (!leadId) {
      addAudit('meta_event_without_lead', { formId, pageId });
      return;
    }

    if (leadId === CONFIG.fakeLeadId) {
      addAudit('meta_fake_test_lead', { leadId, formId, pageId });
      return;
    }

    if (!CONFIG.accessToken) {
      addAudit('meta_missing_token', { leadId, formId, pageId });
      return;
    }

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

        return data;
      } catch (error) {
        const parsed = parseMetaError(error);

        if (isPermissionError(parsed)) {
          throw new Error(`MISSING_PERMISSIONS: ${parsed.message}`);
        }

        if (attempt < CONFIG.maxRetries && isRetryableError(parsed)) {
          await sleep(CONFIG.retryDelayMs);
          return fetchLeadData(attempt + 1);
        }

        throw new Error(`META_GRAPH_FAILED: ${parsed.message}`);
      }
    };

    try {
      const rawData = await fetchLeadData();
      const leadInfo = normalizeLeadInfoFromMeta(rawData);

      runtime.metrics.metaLeads += 1;
      addAudit('meta_lead_received', {
        leadId,
        formId,
        pageId,
        source: leadInfo.source
      });

      const result = await processInboundLead(
        axios,
        runtime,
        addAudit,
        leadInfo,
        { channel: 'metaAds', sendToCRM: true }
      );

      addAudit('meta_lead_success', {
        leadId,
        formId,
        pageId,
        score: result.score.clase,
        scoreValue: result.score.score,
        zohoOk: result.zoho.ok,
        salesOsOk: result.salesOs.ok
      });
    } catch (error) {
      addAudit('meta_lead_error', {
        leadId,
        formId,
        pageId,
        error: error.message
      });
    }
  });
}
