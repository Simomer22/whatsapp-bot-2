import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import Pino from "pino"
import { Boom } from "@hapi/boom"
import http from "http"

http.createServer((req, res) => res.end("Bot running")).listen(process.env.PORT || 3000)

const greetedUsers = new Set()

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: Pino({ level: "silent" })
    })

    sock.ev.on("connection.update", async update => {
        const reason = new Boom(update.lastDisconnect?.error)?.output?.statusCode

        if (update.connection === "close") {
            console.log("Connection closed", reason)
            if (reason !== DisconnectReason.loggedOut) {
                connect()
            }
        } else if (update.connection === "open") {
            console.log("🤖 BOT CONNECTED!")
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe || !m.key.remoteJid.endsWith("@s.whatsapp.net")) return

        const from = m.key.remoteJid
        const body = m.message.conversation?.toLowerCase() ||
                     m.message.extendedTextMessage?.text?.toLowerCase() ||
                     ""

        if (!greetedUsers.has(from)) {
            greetedUsers.add(from)
            await sock.sendMessage(from, { text: "👋 مرحبا!" })
        }

        if (["catalog","produit","product","كتالوگ"].some(k=>body.includes(k))) {
            await sock.sendMessage(from,{text:"🛍️ المنتجات:\n1️⃣ Parfum\n2️⃣ Crème\n3️⃣ Sérum"})
            return
        }

        await sock.sendMessage(from, { text: `📩 توصلت: *${body}*` })
    })
}

connect()
