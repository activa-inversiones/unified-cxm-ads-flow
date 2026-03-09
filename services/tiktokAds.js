export function registerTikTokRoutes(app, runtime, addAudit) {
  app.post('/webhook/tiktok/event', async (req, res) => {
    try {
      const { eventName, value, currency } = req.body || {};

      if (!eventName) {
        return res.status(400).json({
          ok: false,
          error: 'Falta eventName'
        });
      }

      runtime.metrics.tiktokEvents += 1;

      addAudit('tiktok_event_received', {
        eventName,
        value: value || 0,
        currency: currency || 'CLP'
      });

      return res.json({
        ok: true,
        received: true
      });
    } catch (error) {
      addAudit('tiktok_event_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error TikTok event'
      });
    }
  });
}
