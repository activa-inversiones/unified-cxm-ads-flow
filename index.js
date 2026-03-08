/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v5.4 (SECURE AI BACKEND)
 * Central de Inteligencia: Meta Ads + Google Ads + OpenAI Segura + Zoho CRM
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

app.use(express.static('public'));
app.use(express.static('.')); 

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- 1. RUTA DEL DASHBOARD INTELIGENTE ---
app.get('/', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');

    if (fs.existsSync(publicPath)) res.sendFile(publicPath);
    else if (fs.existsSync(rootPath)) res.sendFile(rootPath);
    else res.status(404).send("<h1>Falta index.html</h1>");
});

// --- 2. PUENTES SEGUROS PARA INTELIGENCIA ARTIFICIAL (FRONTEND) ---
app.post('/api/ai/chat', async (req, res) => {
    const { prompt, system } = req.body;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Falta variable OPENAI_API_KEY en Railway" });
    
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
        }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` } });
        
        res.json({ content: response.data.choices[0].message.content });
    } catch (e) {
        console.error("❌ Error IA Chat:", e.response?.data || e.message);
        res.status(500).json({ error: "Error procesando GPT-4o" });
    }
});

app.post('/api/ai/image', async (req, res) => {
    const { prompt } = req.body;
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Falta variable OPENAI_API_KEY en Railway" });
    
    try {
        const response = await axios.post('https://api.openai.com/v1/images/generations', {
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024"
        }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` } });
        
        res.json({ url: response.data.data[0].url });
    } catch (e) {
        console.error("❌ Error IA Image:", e.response?.data || e.message);
        res.status(500).json({ error: "Error procesando DALL-E 3" });
    }
});

// --- 3. INTELIGENCIA ARTIFICIAL SCORING (BACKEND) ---
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
    } catch (e) { return { score: 5, clase: "Normal", razon: "Fallo preventivo IA" }; }
}

// --- 4. MOTOR ZOHO CRM ---
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

// --- 5. WEBHOOKS META ADS ---
app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) res.status(200).send(req.query['hub.challenge']);
    else res.sendStatus(403);
});

app.post('/webhook/meta', async (req, res) => {
    const leadId = req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (leadId) {
        console.log(`🚀 [Incoming] Lead ID Detectado: ${leadId}`);
        try {
            const fbRes = await axios.get(`https://graph.facebook.com/v22.0/${leadId}?access_token=${process.env.META_ACCESS_TOKEN}`);
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
        } catch (error) { console.error("❌ [Error Meta]:", error.message); }
    }
    res.sendStatus(200);
});

// --- 6. WEBHOOK GOOGLE ADS ---
app.post('/webhook/google', async (req, res) => {
    try {
        const data = req.body;
        let leadName = "Lead Google Elite", leadEmail = "", leadPhone = "";
        
        if (data.user_column_data) {
            data.user_column_data.forEach(field => {
                if (field.column_id === 'FULL_NAME' || field.column_id === 'FIRST_NAME') leadName = field.string_value;
                if (field.column_id === 'EMAIL') leadEmail = field.string_value;
                if (field.column_id === 'PHONE_NUMBER') leadPhone = field.string_value;
            });
        }
        console.log(`🚀 [Incoming Google] Intención de Búsqueda Capturada: ${leadName}`);
        
        const zohoToken = await getFreshZohoToken();
        if (zohoToken) {
            await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                data: [{
                    "Last_Name": leadName,
                    "Email": leadEmail,
                    "Phone": leadPhone,
                    "Description": `Lead Alta Intención B2B.\nMotor: Google Ads Elite v5.4`,
                    "Lead_Source": "Google Ads"
                }]
            }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
        }
        res.status(200).send({ "status": "success" });
    } catch (error) { res.status(500).send("Error Google Webhook"); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("==========================================");
    console.log(`🏎️  ACTIVA ELITE v5.4 SECURE AI BACKEND`);
    console.log(`📍 PORT: ${PORT} | STATUS: DASHBOARD READY`);
    console.log("==========================================");
});
