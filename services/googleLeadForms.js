import axios from 'axios';
import { processInboundLead } from './crmRouter.js';

export function registerGoogleLeadFormRoutes(app, runtime, addAudit) {
  app.post('/webhook/google/lead', async (req, res) => {
    try {
      console.log('📩 [GOOGLE LEAD RAW BODY]:', JSON.stringify(req.body, null, 2));

      const {
        lead_id,
        form_id,
        campaign_id,
        ad_group_id,
        ad_id,
        lead_name,
        lead_email,
        lead_phone,
        company,
        city,
        notes,
        source,
        test_mode,
        gclid,
        created_at
      } = req.body || {};

      if (!lead_email && !lead_phone) {
        addAudit('google_lead_invalid', {
          reason: 'missing_email_and_phone',
          body: req.body
        });

        return res.status(400).json({
          ok: false,
          error: 'Debe venir al menos lead_email o lead_phone'
        });
      }

      const normalizedLead = {
        lead_id: lead_id || '',
        form_id: form_id || '',
        campaign_id: campaign_id || '',
        ad_group_id: ad_group_id || '',
        ad_id: ad_id || '',
        name: lead_name || 'Lead Google',
        email: lead_email || '',
        phone: lead_phone || '',
        company: company || '',
        city: city || '',
        notes: notes || '',
        gclid: gclid || '',
        created_at: created_at || new Date().toISOString(),
        source: source || 'Google Lead Form',
        test_mode: Boolean(test_mode)
      };

      runtime.metrics.googleLeadFormLeads += 1;

      addAudit('google_lead_received', normalizedLead);

      const result = await processInboundLead(
        axios,
        runtime,
        addAudit,
        normalizedLead,
        { channel: 'googleLeadForms', sendToCRM: true }
      );

      console.log('✅ [GOOGLE LEAD] Lead procesado');
      console.log(JSON.stringify(result, null, 2));

      return res.status(200).json({
        ok: true,
        received: true,
        message: 'Lead de Google registrado y enrutado',
        action: result.action,
        score: result.score,
        zoho: result.zoho,
        dedupeKeys: result.dedupeKeys
      });
    } catch (error) {
      console.error('❌ [GOOGLE LEAD ERROR]:', error.message);

      addAudit('google_lead_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error procesando lead de Google'
      });
    }
  });
}
