import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"
import Pino from "pino"
import { Boom } from "@hapi/boom"

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        logger: Pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
        version
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const status = new Boom(lastDisconnect?.error)?.output?.statusCode
            console.log("Connection closed", status)
            if (status !== DisconnectReason.loggedOut) connect()
        } else {
            console.log("Connected ✔️")
        }
    })
}

connect()
