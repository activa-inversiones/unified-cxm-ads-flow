
import axios from 'axios';

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

      runtime.metrics.metaLeads += 1;

      const leadData = response.data;
      const fieldData = leadData.field_data || [];

      const getField = (name) =>
        fieldData.find((f) => f.name === name)?.values?.[0] || '';

      const budget =
        getField('presupuesto_estimado_para_ventanas') ||
        getField('Presupuesto estimado para ventanas');

      const qty =
        getField('cuantas_ventanas_necesitas_cotizar') ||
        getField('¿cuántas ventanas necesitas cotizar?');

      const projectType =
        getField('tipo_de_proyecto') ||
        getField('Tipo de proyecto');

      const vip =
        String(qty).includes('10') ||
        String(qty).toLowerCase().includes('más de 30') ||
        String(projectType).toLowerCase().includes('proyecto inmobiliario') ||
        String(projectType).toLowerCase().includes('condominio') ||
        String(budget).toLowerCase().includes('$3m') ||
        String(budget).toLowerCase().includes('$10m');

      if (vip) runtime.metrics.vipLeads += 1;

      addAudit('meta_lead_received', {
        leadId,
        formId,
        pageId,
        vip
      });

      console.log('✅ [META] Lead recibido correctamente');
      console.log(JSON.stringify(leadData, null, 2));

      // Siguiente paso:
      // conectar scoring IA + Zoho CRM aquí
    } catch (error) {
      console.error('❌ [META RAW ERROR]:', JSON.stringify(error.response?.data || error.message, null, 2));
      addAudit('meta_error', {
        error: error.response?.data || error.message
      });
    }
  });
}
