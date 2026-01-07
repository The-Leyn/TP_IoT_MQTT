// const WebSocket = require("ws");
// const mqtt = require("mqtt");
// const client = mqtt.connect("mqtt://captain.dev0.pandor.cloud:1884");
//
// const webSocketClients = [];
// client.on("connect", () => {
//   client.subscribe("classroom/esp32-06/telemetry", (err) => {
//     if (!err) {
//       console.log("subscribed to topic !");
//     }
//   });
// });
//
// client.on("message", (topic, message) => {
//   // message is Buffer
//   const telemetry = JSON.parse(message.toString());
//   console.log(telemetry);
//
//   webSocketClients.forEach((ws) => {
//     ws.send(JSON.stringify(telemetry));
//   });
// });
//
// const wss = new WebSocket.Server({ port: 8080 });
//
// wss.on("connection", (ws) => {
//   // ws.send("Hello from the other side");
//
//   // ws.on("message", (msg) => {
//   //     ws.send('echo' + msg);
//   // })
//
//   webSocketClients.push(ws);
//
//   // setInterval(() => {
//   //     ws.send(Math.floor(Math.random() * 10) + '°C');
//   // },1000);
// });
//
// console.log("WebSocket Server on ws://localhost:8080");

const WebSocket = require("ws");
const mqtt = require("mqtt");

// --- CONFIGURATION ---
const MQTT_BROKER = "mqtt://captain.dev0.pandor.cloud:1884";
const WS_PORT = 8080;

// Connexion au broker distant
const mqttClient = mqtt.connect(MQTT_BROKER);

// Liste des clients WebSocket (le front Svelte)
const webSocketClients = new Set();

// 1. GESTION MQTT
mqttClient.on("connect", () => {
  console.log("✅ Connecté au Broker MQTT Pandor");

  // On s'abonne avec le wildcard '+' pour écouter TOUS les esp32
  mqttClient.subscribe("classroom/+/telemetry", (err) => {
    if (!err) {
      console.log("📡 Abonné au topic : classroom/+/telemetry");
    } else {
      console.error("❌ Erreur d'abonnement MQTT:", err);
    }
  });
});

mqttClient.on("message", (topic, message) => {
  // Topic format : "classroom/esp32-06/telemetry"
  const parts = topic.split("/");
  const deviceId = parts[1]; // Récupère "esp32-06"

  try {
    const payload = JSON.parse(message.toString());

    // On prépare un objet propre pour le front
    const dataToSend = {
      deviceId: deviceId, // Qui envoie ?
      data: payload, // { tempC: 22, ... }
      timestamp: Date.now(), // Quand on l'a reçu
    };

    console.log(`📥 Reçu de ${deviceId}:`, payload);

    // On broadcast à tous les clients connectés au site web
    webSocketClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(dataToSend));
      }
    });
  } catch (e) {
    console.error("⚠️ Erreur : Message non JSON reçu sur", topic);
  }
});

// 2. GESTION WEBSOCKET
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("connection", (ws) => {
  console.log("✨ Nouveau client Svelte connecté");
  webSocketClients.add(ws);

  ws.send(
    JSON.stringify({ type: "INFO", message: "Bienvenue sur le Bridge MQTT" }),
  );

  ws.on("close", () => {
    console.log("❌ Client Svelte déconnecté");
    webSocketClients.delete(ws);
  });

  ws.on("error", () => {
    webSocketClients.delete(ws);
  });
});

console.log(`🚀 Bridge démarré sur ws://localhost:${WS_PORT}`);
