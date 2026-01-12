import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import Pino from "pino"
import { Boom } from "@hapi/boom"

const greetedUsers = new Set() // ✔️ باش مانرجعوش نجاوبو بزاف

async function connect() {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState("./auth")
    const sock = makeWASocket({
        version,
        logger: Pino({ level: "silent" }),
        auth: state
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log("\n======= QR CODE =======")
            console.log(qr)
            console.log("======================\n")
        }

        if (connection === "open") console.log("🤖 BOT CONNECTED!")
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            console.log("❌ BOT DISCONNECTED!", reason)

            if (reason === DisconnectReason.loggedOut) {
                console.log("🧹 Session deleted. Scan QR again.")
                process.exit()
            } else {
                console.log("♻️ Reconnecting…")
                connect()
            }
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return
        if (msg.key.fromMe) return

        const from = msg.key.remoteJid
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""

        console.log("📩 Received:", text)

        // 🔥 أول مرة فقط → رحاب و كتالوغ
        if (!greetedUsers.has(from)) {
            greetedUsers.add(from)

            await sock.sendMessage(from, { text: "👋 مرحبا! كيف نقدر نعاونك؟ 😊" })

            await sock.sendMessage(from, {
                text: `
✨ مرحبا بك مع متجرنا!
📦 كتالوغ المنتجات:

1️⃣ ساعة – 199 درهم  
2️⃣ سماعات – 149 درهم  

😍 قولي ليا رقم المنتوج لي عجبك
`
            })

            return // ❗ وقف هنا باش مايرسلش مرة أخرى
        }

        // 🔎 تعامل مع الردود من بعد
        if (text === "1") {
            await sock.sendMessage(from, { text: "⌚ الساعة زوينة بزاف! الثمن 199 درهم 🚚 توصيل متوفر" })
        }

        if (text === "2") {
            await sock.sendMessage(from, { text: "🎧 سماعات مزيانة! الثمن 149 درهم 🚚 توصيل متوفر" })
        }
    })
}

connect()
