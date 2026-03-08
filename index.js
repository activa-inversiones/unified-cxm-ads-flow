/**
 * 🏎️ UNIFIED-CXM ADS FLOW - MODO FERRARI v4.3 (FINAL PRODUCTION)
 * Central de Inteligencia: Meta Ads + Google Ads + OpenAI + Zoho CRM
 * v4.3: Smart Directory Discovery & Permanent Token Optimization
 */

import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// --- 1. CONFIGURACIÓN DE PERSISTENCIA (Firebase) ---
const firebaseConfigStr = process.env.FIREBASE_CONFIG;
let db;

if (firebaseConfigStr && firebaseConfigStr !== "{}" && firebaseConfigStr !== undefined) {
    try {
        const firebaseConfig = JSON.parse(firebaseConfigStr);
        const firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        console.log("✔️ [Firebase] Persistencia de datos activada.");
    } catch (e) {
        console.warn("⚠️ [Firebase] Operando en modo volátil (Sin BD).");
    }
}

// --- 2. GESTIÓN DEL DASHBOARD (Sirve el gráfico) ---
// Estas líneas permiten que el servidor encuentre el index.html en cualquier ubicación
app.use(express.static('public'));
app.use(express.static('.'));

app.get('/', (req, res) => {
    // Busca el archivo en orden de prioridad para evitar el error 'Not Found'
    const locations = [
        path.join(__dirname, 'index.html'),
        path.join(__dirname, 'public', 'index.html'),
        path.join(process.cwd(), 'index.html')
    ];

    const targetFile = locations.find(loc => fs.existsSync(loc));

    if (targetFile) {
        res.sendFile(targetFile);
    } else {
        res.status(404).send(`
            <body style="background:#030712;color:#f3f4f6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
                <div style="border:1px solid #1e293b;padding:50px;border-radius:30px;background:#0f172a;max-width:500px;">
                    <h1 style="color:#06b6d4;margin-bottom:20px;">🚀 Motor Elite v4.3 Online</h1>
                    <p style="line-height:1.6;">Servidor activo, pero falta el archivo <b>index.html</b> en GitHub.</p>
                    <p style="font-size:12px;color:#64748b;">Asegúrate de subir el archivo del tablero al repositorio principal.</p>
                </div>
            </body>
        `);
    }
});

// --- 3. MOTOR DE INTELIGENCIA Y CRM ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

/**
 * Obtiene un Access Token fresco de Zoho usando el Refresh Token permanente.
 */
async function getZohoToken() {
    try {
        const params = new URLSearchParams();
        params.append('refresh_token', ZOHO_REFRESH_TOKEN);
        params.append('client_id', process.env.ZOHO_CLIENT_ID);
        params.append('client_secret', process.env.ZOHO_CLIENT_SECRET);
        params.append('grant_type', 'refresh_token');
        const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', params);
        return res.data.access_token;
    } catch (e) { 
        console.error("❌ [Zoho] Error renovando token.");
        return null; 
    }
}

// --- 4. WEBHOOKS (Meta Ads Flow) ---

// Verificación del Webhook por parte de Meta
app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else { res.sendStatus(403); }
});

// Recepción y procesamiento de Leads en tiempo real
app.post('/webhook/meta', async (req, res) => {
    const leadId = req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (leadId) {
        console.log(`🚀 [Incoming] Procesando Lead ID: ${leadId}`);
        try {
            const fbToken = process.env.META_ACCESS_TOKEN;
            // Consultamos los detalles del lead a la API de Meta
            const fbRes = await axios.get(`https://graph.facebook.com/v22.0/${leadId}?access_token=${fbToken}`);
            const data = fbRes.data;

            const leadInfo = {
                name: data.field_data?.find(f => f.name === 'full_name')?.values[0] || "Cliente Meta",
                email: data.field_data?.find(f => f.name === 'email')?.values[0] || "",
                phone: data.field_data?.find(f => f.name === 'phone_number')?.values[0] || "",
                source: "Meta Ads Elite"
            };

            // Registro en Firestore para el historial del Dashboard
            if (db) {
                const appId = process.env.APP_ID || 'activa-elite';
                await setDoc(doc(collection(db, `artifacts/${appId}/public/data/leads`), leadId), {
                    ...leadInfo,
                    timestamp: serverTimestamp()
                });
            }

            // Envío a Zoho CRM
            const zohoToken = await getZohoToken();
            if (zohoToken) {
                await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                    data: [{
                        "Last_Name": leadInfo.name,
                        "Email": leadInfo.email,
                        "Phone": leadInfo.phone,
                        "Description": `Lead inyectado por motor v4.3 - Permanent Token Mode`,
                        "Lead_Source": "Meta Ads"
                    }]
                }, { headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } });
                console.log(`🏁 [Success] Lead ${leadInfo.name} enviado a Zoho CRM.`);
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
    console.log(`🏎️  ACTIVA ELITE v4.3 FINAL READY`);
    console.log(`📍 PORT: ${PORT} | STATUS: LIVE OPERATIONS`);
    console.log("==========================================");
});
