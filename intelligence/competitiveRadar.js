export function registerCompetitiveRadarRoutes(app, runtime, addAudit) {
  app.post('/api/radar/keyword', (req, res) => {
    try {
      const {
        keyword,
        our_position,
        competitor,
        competitor_position,
        source,
        market,
        notes
      } = req.body || {};

      if (!keyword) {
        addAudit('competitive_radar_invalid', {
          reason: 'missing_keyword',
          body: req.body
        });

        return res.status(400).json({
          ok: false,
          error: 'Falta keyword'
        });
      }

      addAudit('competitive_radar_received', {
        keyword,
        our_position: typeof our_position === 'undefined' ? null : our_position,
        competitor: competitor || '',
        competitor_position:
          typeof competitor_position === 'undefined' ? null : competitor_position,
        source: source || 'manual',
        market: market || 'CL',
        notes: notes || ''
      });

      console.log('✅ [RADAR] Keyword registrada');
      console.log(
        JSON.stringify(
          {
            keyword,
            our_position: typeof our_position === 'undefined' ? null : our_position,
            competitor: competitor || '',
            competitor_position:
              typeof competitor_position === 'undefined' ? null : competitor_position
          },
          null,
          2
        )
      );

      return res.status(200).json({
        ok: true,
        message: 'Keyword registrada en radar competitivo'
      });
    } catch (error) {
      console.error('❌ [COMPETITIVE RADAR ERROR]:', error.message);

      addAudit('competitive_radar_error', {
        error: error.message
      });

      return res.status(500).json({
        ok: false,
        error: 'Error registrando keyword competitiva'
      });
    }
  });
}
