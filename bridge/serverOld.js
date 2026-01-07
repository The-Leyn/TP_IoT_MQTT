const http = require("http");
const crypto = require("crypto");

const PORT = 8080;

function acceptValue(webSocketKey) {
  const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  return crypto
    .createHash("sha1")
    .update(webSocketKey + GUID, "binary")
    .digest("base64");
}

function handleRequest(req, res) {
  res.writeHead(200, { "Content-Type": "text/plain " });
  res.end("HTTP OK\n");
}

function handleReady() {
  console.log("I'm ready on http://localhost:" + PORT);
}

function sendText(socket, text) {
  // FIN + text opcode
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;

  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len; // server frames are NOT masked
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

function parseFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (true) {
    if (buffer.length - offset < 2) break;

    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];

    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;

    if (!fin) throw new Error("Fragmented frames not supported");

    let headerLen = 2;
    if (len === 126) {
      if (buffer.length - offset < 4) break;
      len = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (len === 127) {
      if (buffer.length - offset < 10) break;
      const bigLen = buffer.readBigUInt64BE(offset + 2);
      if (bigLen > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error("Too large");
      len = Number(bigLen);
      headerLen = 10;
    }

    const maskLen = masked ? 4 : 0;
    const total = headerLen + maskLen + len;
    if (buffer.length - offset < total) break;

    let payloadStart = offset + headerLen;
    let mask;
    if (masked) {
      mask = buffer.subarray(payloadStart, payloadStart + 4);
      payloadStart += 4;
    }

    let payload = buffer.subarray(payloadStart, payloadStart + len);
    if (masked) {
      const unmasked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i & 3];
      payload = unmasked;
    }

    frames.push({ opcode, payload });
    offset += total;
  }

  return { frames, remaining: buffer.subarray(offset) };
}

const server = http.createServer(handleRequest);

// GERE "L'Upgrade de protocole"

function handleUpgrade(req, socket) {
  const upgrade = (req.headers["upgrade"] || "").toLowerCase();
  const key = req.headers["sec-websocket-key"];
  const version = req.headers["sec-websocket-version"];

  if (upgrade !== "websocket" || !key || version !== "13") {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  const accept = acceptValue(key);

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      "\r\n",
  );

  sendText(socket, "Hello from the other side");

  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    let parsed;
    try {
      parsed = parseFrames(buffer);
    } catch {
      socket.destroy();
      return;
    }

    buffer = parsed.remaining;

    for (const frame of parsed.frames) {
      if (frame.opcode === 0x1) {
        const msg = frame.payload.toString("utf8");
        console.log("Message received");
        sendText(socket, `echo: ${msg}`);
      }
    }
  });
}

server.on("upgrade", handleUpgrade);

server.listen(PORT, handleReady);
