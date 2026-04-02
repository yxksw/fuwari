import { WebSocket, WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

const clients = new Map();

const wss = new WebSocketServer({ port: PORT });

console.log("[NAT] 信令服务器启动在端口 " + PORT);

wss.on("connection", (ws, req) => {
	const clientId = generateId();
	const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

	console.log("[NAT] 新连接: " + clientId + " 来自 " + clientIp);

	const client = {
		id: clientId,
		ws: ws,
		ip: clientIp,
		iceCandidates: [],
	};

	clients.set(clientId, client);

	ws.on("message", (data) => {
		try {
			const message = JSON.parse(data.toString());
			handleMessage(client, message);
		} catch (error) {
			console.error("[NAT] 解析消息失败:", error);
			ws.send(JSON.stringify({ error: "消息格式错误" }));
		}
	});

	ws.on("close", () => {
		console.log("[NAT] 连接关闭: " + clientId);
		clients.delete(clientId);
	});

	ws.on("error", (error) => {
		console.error("[NAT] 连接错误: " + clientId, error);
		clients.delete(clientId);
	});
});

function handleMessage(client, message) {
	if (message.sdp) {
		console.log("[NAT] 收到SDP Offer");

		const answer = generateSdpAnswer(message.sdp);
		client.ws.send(JSON.stringify({ sdp: answer }));
		console.log("[NAT] 已发送SDP Answer");

		setTimeout(() => {
			analyzeAndSendResult(client);
		}, 3000);
	}

	if (message["ice-candidate"]) {
		const candidate = message["ice-candidate"];
		const candidateInfo = parseIceCandidate(candidate);

		client.iceCandidates.push(candidateInfo);
		console.log(
			"[NAT] 收到ICE候选者: " +
				candidateInfo.type +
				" " +
				candidateInfo.ip +
				":" +
				candidateInfo.port,
		);

		const serverCandidate = generateServerCandidate(candidateInfo);
		client.ws.send(JSON.stringify({ "ice-candidate": serverCandidate }));
	}
}

function parseIceCandidate(candidate) {
	const parts = candidate.split(" ");
	const typeIndex = parts.indexOf("typ");
	return {
		ip: parts[4],
		port: Number.parseInt(parts[5]),
		type: typeIndex >= 0 ? parts[typeIndex + 1] : "unknown",
	};
}

function generateSdpAnswer(offerSdp) {
	let answer = offerSdp;
	answer = answer.replace(/a=setup:actpass/g, "a=setup:active");
	answer = answer.replace(/a=setup:passive/g, "a=setup:active");
	answer = answer.replace(
		/o=- \d+ \d+ IN IP4/,
		"o=- " + Date.now() + " " + Date.now() + " IN IP4",
	);
	answer = answer.replace(/a=ice-lite/g, "");
	return answer;
}

function generateServerCandidate(clientInfo) {
	return (
		"candidate:1 1 udp 2130706431 0.0.0.0 12345 typ srflx raddr " +
		clientInfo.ip +
		" rport " +
		clientInfo.port
	);
}

function analyzeAndSendResult(client) {
	const candidates = client.iceCandidates;

	console.log("[NAT] 分析 " + candidates.length + " 个候选者...");

	const srflxCandidates = candidates.filter((c) => c.type === "srflx");

	if (srflxCandidates.length === 0) {
		client.ws.send(JSON.stringify({ nat_type: "Blocked", public_ip: "未知" }));
		return;
	}

	const publicIp = srflxCandidates[0].ip;
	const uniquePorts = new Set(srflxCandidates.map((c) => c.port));

	console.log("[NAT] 公网IP: " + publicIp);
	console.log("[NAT] 端口数量: " + uniquePorts.size);
	console.log("[NAT] 端口列表: " + Array.from(uniquePorts).join(", "));

	let natType;

	if (uniquePorts.size === 1) {
		// 同一连接返回相同端口 = Full Cone
		natType = "Full Cone";
	} else {
		// 端口不同 = Symmetric
		natType = "Symmetric";
	}

	const result = { nat_type: natType, public_ip: publicIp };
	console.log("[NAT] 发送结果: " + JSON.stringify(result));
	client.ws.send(JSON.stringify(result));
}

function generateId() {
	return Math.random().toString(36).substring(2, 10);
}

process.on("SIGINT", () => {
	console.log("\n[NAT] 正在关闭服务器...");
	wss.close(() => {
		console.log("[NAT] 服务器已关闭");
		process.exit(0);
	});
});
