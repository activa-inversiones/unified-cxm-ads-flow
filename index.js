/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v4.2 (SMART DASHBOARD & SYSTEM TOKEN)
 * Central de Inteligencia: Meta Ads + Google Ads + OpenAI + Zoho CRM
 * v4.2: Corrección de ruta index.html (Busca en raíz y en /public)
 */

import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 📂 Servimos archivos estáticos (por si acaso usas la carpeta public)
app.use(express.static('public'));
app.use(express.static('.')); 

// --- 1. RUTA DEL DASHBOARD INTELIGENTE ---
app.get('/', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');

    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
        res.sendFile(rootPath);
    } else {
        res.status(404).send(`
            <body style="background:#030712;color:#f3f4f6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;border:1px solid #1e293b;padding:40px;border-radius:24px;background:#0f172a;">
                    <h1 style="color:#06b6d4;">🚀 Motor v4.2 Online</h1>
                    <p>El servidor funciona, pero falta subir el archivo <b>index.html</b> a GitHub.</p>
                    <p style="font-size:12px;color:#64748b;">Asegúrate de que el archivo del gráfico esté en tu repositorio principal.</p>
                </div>
            </body>
        `);
    }
});

// --- 2. INTELIGENCIA ARTIFICIAL SCORING ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function runAiLeadScoring(leadData) {
    if (!OPENAI_API_KEY) return { score: 5, clase: "Normal", razon: "IA offline" };
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Analista senior de Activa Inversiones. Clasifica prospectos de ventanas premium." },
                { role: "user", content: `Analiza este prospecto: ${JSON.stringify(leadData)}. Responde estrictamente en JSON: { "score": 1-10, "clase": "VIP"|"Normal", "razon": "breve" }` }
            ],
            response_format: { type: "json_object" }
        }, { headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY } });
        return JSON.parse(res.data.choices[0].message.content);
    } catch (e) { 
        return { score: 5, clase: "Normal", razon: "Fallo preventivo IA" }; 
    }
}

// --- 3. MOTOR ZOHO CRM ---
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

// --- 4. WEBHOOKS ---

app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else { res.sendStatus(403); }
});

app.post('/webhook/meta', async (req, res) => {
    const leadId = req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (leadId) {
        console.log(`🚀 [Incoming] Lead ID Detectado: ${leadId}`);
        try {
            const fbToken = process.env.META_ACCESS_TOKEN; 
            const fbRes = await axios.get(`https://graph.facebook.com/v22.0/${leadId}?access_token=${fbToken}`);
            const data = fbRes.data;

            const leadInfo = {
                name: data.field_data?.find(f => f.name === 'full_name')?.values[0] || "Cliente Meta",
                email: data.field_data?.find(f => f.name === 'email')?.values[0] || "",
                phone: data.field_data?.find(f => f.name === 'phone_number')?.values[0] || "",
                source: "Meta Ads Elite"
            };

            const score = await runAiLeadScoring(leadInfo);
            const zohoToken = await getFreshZohoToken();

            if (zohoToken) {
                await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                    data: [{
                        "Last_Name": leadInfo.name,
                        "Email": leadInfo.email,
                        "Phone": leadInfo.phone,
                        "Description": `[IA-RANK: ${score.score}/10] ${score.razon}`,
                        "Rating": score.clase === "VIP" ? "Alta" : "Media",
                        "Lead_Source": "Meta Ads"
                    }]
                }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
                console.log(`🏁 [Success] Lead ${leadInfo.name} inyectado en Zoho.`);
            }
        } catch (error) {
            console.error("❌ [Error Meta API]:", error.response?.data || error.message);
        }
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("==========================================");
    console.log(`🏎️  ACTIVA ELITE v4.2 SMART OPS`);
    console.log(`📍 PORT: ${PORT} | STATUS: DASHBOARD READY`);
    console.log("==========================================");
});
