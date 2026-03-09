export function registerWebFormRoutes(app, runtime, addAudit) {
  app.post('/webhook/web/form', async (req, res) => {
    try {
      console.log('📩 [WEB FORM RAW BODY]:', JSON.stringify(req.body, null, 2));

      const {
        lead_id,
        form_name,
        page_url,
        lead_name,
        lead_email,
        lead_phone,
        project_type,
        windows_qty,
        budget,
        message,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        gclid,
        fbclid,
        ttclid,
        source,
        test_mode,
        created_at
      } = req.body || {};

      if (!lead_email && !lead_phone) {
        addAudit('web_form_invalid', {
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
        form_name: form_name || 'Web Form',
        page_url: page_url || '',
        name: lead_name || 'Lead Web',
        email: lead_email || '',
        phone: lead_phone || '',
        project_type: project_type || '',
        windows_qty: windows_qty || '',
        budget: budget || '',
        message: message || '',
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        utm_content: utm_content || '',
        gclid: gclid || '',
        fbclid: fbclid || '',
        ttclid: ttclid || '',
        created_at: created_at || new Date().toISOString(),
        source: source || 'Web Form',
        test_mode: Boolean(test_mode)
      };

      addAudit('web_form_lead_received', normalizedLead);

      console.log('✅ [WEB FORM] Lead recibido');
      console.log(JSON.stringify(normalizedLead, null, 2));

      return res.status(200).json({
        ok: true,
        received: true,
        message: 'Lead web registrado en auditoría',
        dedupe_key_hint: `${normalizedLead.source}|${normalizedLead.email}|${normalizedLead.phone}`
      });
    } catch (error) {
      console.error('❌ [WEB FORM ERROR]:', error.message);

      addAudit('web_form_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error procesando formulario web'
      });
    }
  });
}
