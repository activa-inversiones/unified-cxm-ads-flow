import axios from 'axios';
import { normalizeLeadInfoFromMeta, getFinalLeadScore } from '../intelligence/leadScoring.js';
import { sendLeadToZoho } from './zohoCRM.js';

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';

export function registerMetaRoutes(app, runtime, addAudit) {
  app.get('/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      addAudit('meta_webhook_verified');
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  });

  app.post('/webhook/meta', async (req, res) => {
    res.sendStatus(200);

    try {
      const leadId = req.body?.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
      const formId = req.body?.entry?.[0]?.changes?.[0]?.value?.form_id;
      const pageId = req.body?.entry?.[0]?.changes?.[0]?.value?.page_id;

      if (!leadId) {
        addAudit('meta_event_without_lead');
        return;
      }

      console.log(`🚀 [META] Lead ID: ${leadId}`);

      if (leadId === '444444444444') {
        console.warn('⚠️ [META] Lead fake de prueba detectado');
        addAudit('meta_fake_test_lead', { leadId, formId, pageId });
        return;
      }

      if (!META_ACCESS_TOKEN) {
        console.error('❌ [META] Falta META_ACCESS_TOKEN');
        addAudit('meta_missing_token');
        return;
      }

      const response = await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadId}`,
        {
          params: {
            access_token: META_ACCESS_TOKEN,
            fields: 'id,created_time,ad_id,form_id,page_id,field_data'
          },
          timeout: 20000
        }
      );

      const leadData = response.data;
      const leadInfo = normalizeLeadInfoFromMeta(leadData);
      const finalScore = await getFinalLeadScore(axios, leadInfo);
      const zohoResult = await sendLeadToZoho(axios, leadInfo, finalScore);

      runtime.metrics.metaLeads += 1;
      if (finalScore.clase === 'VIP') {
        runtime.metrics.vipLeads += 1;
      }

      addAudit('meta_lead_received', {
        leadId,
        formId,
        pageId,
        vip: finalScore.clase === 'VIP',
        zohoOk: zohoResult.ok
      });

      console.log('✅ [META] Lead procesado');
      console.log('🧠 [SCORE]:', finalScore);
      console.log('📦 [ZOHO]:', zohoResult);
    } catch (error) {
      console.error(
        '❌ [META RAW ERROR]:',
        JSON.stringify(error.response?.data || error.message, null, 2)
      );

      addAudit('meta_error', {
        error: error.response?.data || error.message
      });
    }
  });
}
