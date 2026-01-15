import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import express from "express";
import qrcode from "qrcode-terminal";

const app = express();
app.get("/", (req, res) => res.send("WhatsApp bot working ✔"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🌍 WEB SERVER RUNNING"));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("🤖 BOT CONNECTED!");
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        startBot();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    console.log("📩 RECEIVED:", text);

    if (text?.toLowerCase() === "hi") {
      await sock.sendMessage(msg.key.remoteJid, { text: "Hello 👋" });
    }
  });
}

startBot();
