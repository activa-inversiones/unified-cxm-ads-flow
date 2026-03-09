export function registerTikTokRoutes(app, runtime, addAudit) {
  app.post('/webhook/tiktok/event', async (req, res) => {
    try {
      console.log('📩 [TIKTOK RAW BODY]:', JSON.stringify(req.body, null, 2));

      const {
        eventName,
        eventTime,
        value,
        currency,
        email,
        phone,
        external_id,
        campaign,
        adgroup,
        ad,
        source,
        test_mode
      } = req.body || {};

      if (!eventName) {
        addAudit('tiktok_event_invalid', {
          reason: 'missing_event_name',
          body: req.body
        });

        return res.status(400).json({
          ok: false,
          error: 'Falta eventName'
        });
      }

      runtime.metrics.tiktokEvents += 1;

      addAudit('tiktok_event_received', {
        eventName,
        eventTime: eventTime || new Date().toISOString(),
        value: typeof value === 'undefined' ? 0 : value,
        currency: currency || 'CLP',
        email: email ? 'provided' : 'missing',
        phone: phone ? 'provided' : 'missing',
        external_id: external_id || '',
        campaign: campaign || '',
        adgroup: adgroup || '',
        ad: ad || '',
        source: source || 'TikTok Ads',
        test_mode: Boolean(test_mode)
      });

      console.log('✅ [TIKTOK] Evento registrado');
      console.log(
        JSON.stringify(
          {
            eventName,
            eventTime: eventTime || new Date().toISOString(),
            value: typeof value === 'undefined' ? 0 : value,
            currency: currency || 'CLP',
            test_mode: Boolean(test_mode)
          },
          null,
          2
        )
      );

      return res.status(200).json({
        ok: true,
        received: true,
        tiktokEvents: runtime.metrics.tiktokEvents,
        message: 'Evento TikTok registrado en auditoría'
      });
    } catch (error) {
      console.error('❌ [TIKTOK ERROR]:', error.message);

      addAudit('tiktok_event_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error procesando evento de TikTok'
      });
    }
  });
}
