/* Carga liviana del SDK de Supabase */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* 🔒 Tus credenciales */
const SUPABASE_URL      = "https://jouryaudwgqolcwevyyu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdXJ5YXVkd2dxb2xjd2V2eXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTI4MzQsImV4cCI6MjA2NDcyODgzNH0.gDAYSA6x-bgc4xfF0oM5K8rH96cPPZFeXSRnbitj-qA";
const HF_TOKEN          = "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";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Referencias DOM */
const chat   = document.getElementById("chat");
const form   = document.getElementById("form");
const qInput = document.getElementById("q");

/* Helper para imprimir */
function print(msg) {
  chat.innerHTML += `<p>${msg}</p>`;
  chat.scrollTop  = chat.scrollHeight;
}

/* Consulta de texto a Hugging Face */
async function askLLM(prompt) {
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 256 } }),
      }
    );
    if (!res.ok) throw new Error(`HF status ${res.status}`);
    const json = await res.json();
    return json[0]?.generated_text?.trim() || "⚠️ Sin respuesta.";
  } catch (err) {
    console.error(err);
    return "⚠️ Servicio ocupado o sin internet. Intenta de nuevo.";
  }
}

/* Generación de mock-up */
async function generarMockup(giro, fotoUrl) {
  const promptImg = `Realistic mock-up of a ${giro} inside the building shown here: ${fotoUrl}. \
Keep same walls, floor and add basic signage and furniture.`;
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: promptImg }),
      }
    );
    if (!res.ok) throw new Error(`HF image status ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    print(`<img src="${url}" style="max-width:100%">`);
  } catch (err) {
    console.error(err);
    print("⚠️ No se pudo generar la imagen. Intenta más tarde.");
  }
}

/* Envío del formulario */
form.onsubmit = async (e) => {
  e.preventDefault();
  const pregunta = qInput.value.trim();
  if (!pregunta) return;
  print("🧑‍💼 " + pregunta);
  qInput.value = "";

  /* Traemos los locales */
  const { data, error } = await supabase.from("locales").select("*");
  if (error || !data?.length) {
    print("⚠️ No hay datos de locales o ocurrió un error.");
    return;
  }

  /* Construir prompt */
  const prompt = `
CONTEXTO: ${JSON.stringify(data)}
GIROS: restaurante, cafetería, oficina, coworking, consultorio, mercado, salón de belleza, barbería, heladería, imprenta, gimnasio, electrodomésticos, boutique, farmacia, muebles.
CLIENTE PREGUNTA: """${pregunta}"""
RESPONDE en español de forma breve y clara.
Si el cliente pide un render, responde exactamente la palabra: NECESITA_RENDER
  `;

  /* Preguntar al modelo */
  const respuesta = await askLLM(prompt);

  /* Si necesita render, pedir giro y generar */
  if (respuesta === "NECESITA_RENDER") {
    const giro = prompt("¿Qué giro de negocio? Ej.: farmacia, gimnasio…");
    if (giro) {
      print("🤖 Generando imagen… espera ~20 s");
      await generarMockup(giro, data[0].foto_url);
    }
  } else {
    print("🤖 " + respuesta);
  }
};
