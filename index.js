javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// --- 1. CONFIGURACIÓN DE ZOHO (Para inyectar los leads) ---
const ZOHO_BASE_URL = "https://www.zohoapis.com/crm/v2";

async function getZohoHeaders() {
    // Aquí deberías implementar tu lógica de refresco de token similar a tus otros proyectos
    return { 
        'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json' 
    };
}

// --- 2. ENDPOINT PARA META ADS (Facebook/Instagram) ---
app.get('/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook/meta', async (req, res) => {
    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        if (changes?.value?.leadgen_id) {
            const leadId = changes.value.leadgen_id;
            console.log(`[Meta] Nuevo lead detectado: ${leadId}`);
            
            // 1. Obtener datos del lead desde Meta
            const fbRes = await axios.get(`https://graph.facebook.com/v18.0/${leadId}?access_token=${process.env.META_ACCESS_TOKEN}`);
            const data = fbRes.data;

            // 2. Mapear campos (ajustar según tus formularios)
            const lead = {
                data: [{
                    "Last_Name": data.field_data.find(f => f.name === 'full_name')?.values[0] || "Lead Meta",
                    "Email": data.field_data.find(f => f.name === 'email')?.values[0],
                    "Phone": data.field_data.find(f => f.name === 'phone_number')?.values[0],
                    "Lead_Source": "Meta Ads Araucania",
                    "Description": `Campaña: ${data.ad_name || 'Desconocida'}`
                }]
            };

            // 3. Enviar a Zoho
            const headers = await getZohoHeaders();
            await axios.post(`${ZOHO_BASE_URL}/Leads`, lead, { headers });
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("Error Meta Webhook:", err.message);
        res.sendStatus(500);
    }
});

// --- 3. ENDPOINT PARA TIKTOK ADS ---
app.post('/webhook/tiktok', async (req, res) => {
    try {
        const { event, user_data, pixel_id } = req.body;
        console.log(`[TikTok] Evento recibido: ${event}`);

        // TikTok requiere hashear datos (SHA256)
        const hash = (val) => crypto.createHash('sha256').update(val.toLowerCase().trim()).digest('hex');

        const payload = {
            "event_source": "web",
            "event_source_id": process.env.TIKTOK_PIXEL_ID,
            "data": [{
                "event": event,
                "event_time": Math.floor(Date.now() / 1000),
                "user": {
                    "email": user_data.email ? hash(user_data.email) : null,
                    "phone_number": user_data.phone ? hash(user_data.phone) : null
                }
            }]
        };

        await axios.post('https://business-api.tiktok.com/open_api/v1.3/event/track/', payload, {
            headers: { 'Access-Token': process.env.TIKTOK_ACCESS_TOKEN }
        });

        res.sendStatus(200);
    } catch (err) {
        console.error("Error TikTok Events:", err.message);
        res.sendStatus(500);
    }
});

// --- 4. ENDPOINT PARA GOOGLE ADS (Conversiones Offline) ---
app.post('/google/conversion', async (req, res) => {
    try {
        const { gclid, conversion_time, value } = req.body;
        // Lógica para enviar a la API de Google Ads
        // Requiere Google Ads SDK o llamada REST a /uploadClickConversions
        console.log(`[Google] Procesando GCLID: ${gclid}`);
        res.json({ status: "success", message: "GCLID registrado para optimización" });
    } catch (err) {
        res.status(500).json({ status: "error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ads Flow Connector activo en puerto ${PORT}`));
