// Central de Inteligencia de Tráfico - Activa Inversiones Elite
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const app = express();
app.use(express.json());

// --- CONFIGURACIÓN FIREBASE (Control de Errores) ---
let db, auth;
const firebaseConfigStr = process.env.FIREBASE_CONFIG;
const appId = process.env.APP_ID || 'default-app-id';

if (firebaseConfigStr && firebaseConfigStr !== "{}") {
    try {
        const firebaseConfig = JSON.parse(firebaseConfigStr);
        const firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp);
        auth = getAuth(firebaseApp);
        console.log("✔ Firebase inicializado correctamente.");
    } catch (e) {
        console.error("❌ Error parseando FIREBASE_CONFIG:", e.message);
    }
} else {
    console.warn("⚠️ Advertencia: FIREBASE_CONFIG no detectada. El historial no se guardará.");
}

// --- CONFIGURACIÓN DE IA ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-preview-09-2025";

async function authenticate() {
    if (auth && process.env.INITIAL_AUTH_TOKEN) {
        try {
            await signInWithCustomToken(auth, process.env.INITIAL_AUTH_TOKEN);
        } catch (e) {
            console.error("Auth error:", e.message);
        }
    }
}

async function calificarLead(leadData) {
    if (!GEMINI_API_KEY) return { score: 5, clase: "Normal", razon: "IA no configurada" };
    
    const prompt = `Analiza este prospecto para venta de ventanas premium en Chile: ${JSON.stringify(leadData)}. ¿Es una constructora o un proyecto de alto valor? Responde estrictamente en JSON: { "score": 1-10, "clase": "VIP"|"Normal", "razon": "explicación breve" }`;
    try {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent?key=' + GEMINI_API_KEY;
        const res = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        return JSON.parse(res.data.candidates[0].content.parts[0].text);
    } catch (e) {
        return { score: 5, clase: "Normal", razon: "Error de análisis IA" };
    }
}

// Webhook para Meta Ads - Verificación
app.get('/webhook/meta', (req, res) => {
    if (req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// Webhook para Meta Ads - Recepción de Datos
app.post('/webhook/meta', async (req, res) => {
    const leadId = req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
    if (leadId) {
        try {
            const fbRes = await axios.get('https://graph.facebook.com/v18.0/' + leadId + '?access_token=' + process.env.META_ACCESS_TOKEN);
            const data = fbRes.data;
            const leadInfo = {
                name: data.field_data.find(f => f.name === 'full_name')?.values[0] || "Cliente Meta",
                email: data.field_data.find(f => f.name === 'email')?.values[0],
                phone: data.field_data.find(f => f.name === 'phone_number')?.values[0],
                source: "Meta Ads"
            };

            const score = await calificarLead(leadInfo);

            // Guardar en Firestore si está disponible
            if (db) {
                await authenticate();
                const leadRef = doc(collection(db, 'artifacts/' + appId + '/public/data/leads'), leadId);
                await setDoc(leadRef, { ...leadInfo, score, timestamp: Date.now() });
            }

            // Inyección en Zoho CRM
            const zohoToken = process.env.ZOHO_ACCESS_TOKEN;
            await axios.post("https://www.zohoapis.com/crm/v2/Leads", {
                data: [{
                    "Last_Name": leadInfo.name,
                    "Email": leadInfo.email,
                    "Phone": leadInfo.phone,
                    "Description": "[IA Score: " + score.score + "] " + score.razon,
                    "Lead_Source": "Meta Ads Araucanía"
                }]
            }, { 
                headers: { 'Authorization': 'Zoho-oauthtoken ' + zohoToken } 
            });

            console.log("✔ Lead de Meta procesado: " + leadInfo.name);
        } catch (e) {
            console.error("Error procesando lead:", e.message);
        }
    }
    res.sendStatus(200);
});

// Endpoint para TikTok Ads (Events API)
app.post('/webhook/tiktok', async (req, res) => {
    console.log("Recibido evento de TikTok");
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 CXM Ads Flow Elite activo en puerto ' + PORT));
