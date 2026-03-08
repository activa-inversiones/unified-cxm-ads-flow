/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v4.0 (DASHBOARD & PERMANENT TOKEN)
 * Central de Inteligencia: Meta Ads + Google Ads + OpenAI + Zoho CRM
 * Esta versión sirve el Dashboard Elite v4.0 en la raíz (/)
 */

import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Servimos archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

// --- 1. RUTA DEL DASHBOARD (RAÍZ) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- 2. INTELIGENCIA ARTIFICIAL SCORING (GPT-4o-mini) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function runAiLeadScoring(leadData) {
    if (!OPENAI_API_KEY) return { score: 5, clase: "Normal", razon: "IA offline" };
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Analista de ventas premium para Activa Inversiones en la Araucanía." },
                { role: "user", content: `Analiza este prospecto de ventanas PVC: ${JSON.stringify(leadData)}. Responde estrictamente en JSON: { "score": 1-10, "clase": "VIP"|"Normal", "razon": "breve" }` }
            ],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY } });
        return JSON.parse(res.data.choices[0].message.content);
    } catch (e) { 
        console.error("⚠️ [IA Error]");
        return { score: 5, clase: "Normal", razon: "Fallo preventivo IA" }; 
    }
}

// --- 3. MOTOR ZOHO (Refresh Permanente) ---
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

async function getFreshZohoToken() {
    try {
        const params = new URLSearchParams();
        params.append('refresh_token', ZOHO_REFRESH_TOKEN);
        params.append('client_id', ZOHO_CLIENT_ID);
        params.append('client_secret', ZOHO_CLIENT_SECRET);
        params.append('grant_type', 'refresh_token');
        const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', params);
        return res.data.access_token;
    } catch (e) { return null; }
}

// --- 4. WEBHOOKS DE PRODUCCIÓN ---

app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else { res.sendStatus(403); }
});

app.post('/webhook/meta', async (req, res) => {
    const leadId = req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (leadId) {
        console.log(`🚀 [Incoming] Lead ID: ${leadId}`);
        try {
            const fbToken = process.env.META_ACCESS_TOKEN; 
            const fbRes = await axios.get(`https://graph.facebook.com/v22.0/${leadId}?access_token=${fbToken}`);
            const data = fbRes.data;

            const leadInfo = {
                name: data.field_data?.find(f => f.name === 'full_name')?.values[0] || "Cliente Meta",
                email: data.field_data?.find(f => f.name === 'email')?.values[0] || "",
                phone: data.field_data?.find(f => f.name === 'phone_number')?.values[0] || "",
                source: "Meta Ads"
            };

            const score = await runAiLeadScoring(leadInfo);
            const zohoToken = await getFreshZohoToken();

            if (zohoToken) {
                await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                    data: [{
                        "Last_Name": leadInfo.name,
                        "Email": leadInfo.email,
                        "Phone": leadInfo.phone,
                        "Description": `[RANK: ${score.score}/10] ${score.razon}`,
                        "Rating": score.clase === "VIP" ? "Alta" : "Media",
                        "Lead_Source": "Meta Ads"
                    }]
                }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
                console.log(`🏁 [Success] Lead ${leadInfo.name} inyectado en Zoho.`);
            }
        } catch (error) {
            console.error("❌ [Error Flow]:", error.response?.data || error.message);
        }
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("==========================================");
    console.log(`🏎️  ACTIVA ELITE v4.0 FINAL READY`);
    console.log(`📍 PORT: ${PORT} | STATUS: LIVE OPERATIONS`);
    console.log("==========================================");
});
