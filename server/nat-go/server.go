package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

const (
	cloudflareTurnTokenID = "e0da3fd567df706c40b5d51b2232ecb4"
	cloudflareAPIToken    = "f8aa0e5636dafac481a425a8a31f44aedabc5f058af2884b34c9b63b8f712c38"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// 全局缓存ICE服务器配置
var (
	cachedICEServers []webrtc.ICEServer
	cacheMu          sync.Mutex
	cacheTime        time.Time
)

type Msg struct {
	SDP            string `json:"sdp,omitempty"`
	ICECandidate   string `json:"ice-candidate,omitempty"`
	ProbeSDP       string `json:"probe-sdp,omitempty"`
	ProbeAnswer    string `json:"probe-answer,omitempty"`
	ProbeCandidate string `json:"probe-candidate,omitempty"`
}

type Session struct {
	ws       *websocket.Conn
	pcA      *webrtc.PeerConnection
	pcB      *webrtc.PeerConnection
	publicIP string
	ports    map[string]bool
	mu       sync.Mutex
	pcBRecv  bool
}

func getICEServers() []webrtc.ICEServer {
	cacheMu.Lock()
	defer cacheMu.Unlock()

	// 缓存1小时
	if cachedICEServers != nil && time.Since(cacheTime) < time.Hour {
		return cachedICEServers
	}

	// 调用Cloudflare API获取凭证
	url := "https://rtc.live.cloudflare.com/v1/turn/keys/" + cloudflareTurnTokenID + "/credentials/generate-ice-servers"
	
	reqBody := map[string]int{"ttl": 86400}
	jsonBody, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Println("创建请求失败:", err)
		return getDefaultICEServers()
	}

	req.Header.Set("Authorization", "Bearer "+cloudflareAPIToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Println("请求Cloudflare API失败:", err)
		return getDefaultICEServers()
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Println("Cloudflare API响应:", string(body))

	var result struct {
		ICeServers []struct {
			URLs       []string `json:"urls"`
			Username   string   `json:"username"`
			Credential string   `json:"credential"`
		} `json:"iceServers"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		log.Println("解析响应失败:", err)
		return getDefaultICEServers()
	}

	var servers []webrtc.ICEServer
	for _, s := range result.ICeServers {
		servers = append(servers, webrtc.ICEServer{
			URLs:       s.URLs,
			Username:   s.Username,
			Credential: s.Credential,
		})
	}

	cachedICEServers = servers
	cacheTime = time.Now()

	log.Println("获取到ICE服务器配置:", len(servers))
	return servers
}

func getDefaultICEServers() []webrtc.ICEServer {
	return []webrtc.ICEServer{
		{URLs: []string{"stun:stun.cloudflare.com:3478"}},
		{URLs: []string{"stun:stun.l.google.com:19302"}},
	}
}

func main() {
	// 预热缓存
	go getICEServers()

	http.HandleFunc("/ws", wsHandler)
	log.Println("NAT检测服务器启动在 :9000")
	http.ListenAndServe(":9000", nil)
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket升级失败:", err)
		return
	}
	defer ws.Close()

	session := &Session{
		ws:    ws,
		ports: make(map[string]bool),
	}

	iceServers := getICEServers()

	// 创建pcA（主连接）
	pcA, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: iceServers,
	})
	if err != nil {
		log.Println("创建pcA失败:", err)
		return
	}
	session.pcA = pcA
	defer pcA.Close()

	// 创建pcB（探测连接，使用不同ICE服务器）
	pcB, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: iceServers,
	})
	if err != nil {
		log.Println("创建pcB失败:", err)
		return
	}
	session.pcB = pcB
	defer pcB.Close()

	// pcA配置
	pcA.OnDataChannel(func(dc *webrtc.DataChannel) {
		log.Println("pcA收到DataChannel:", dc.Label())

		dc.OnOpen(func() {
			log.Println("pcA DataChannel已打开")
			go session.startProbe()
		})

		dc.OnMessage(func(msg webrtc.DataChannelMessage) {
			log.Println("pcA收到消息:", string(msg.Data))
		})
	})

	pcA.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		ws.WriteJSON(map[string]string{"ice-candidate": c.ToJSON().Candidate})
	})

	pcA.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Println("pcA ICE状态:", state.String())
	})

	// pcB配置
	pcB.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		ws.WriteJSON(map[string]string{"probe-candidate": c.ToJSON().Candidate})
	})

	pcB.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Println("pcB ICE状态:", state.String())
	})

	pcB.OnDataChannel(func(dc *webrtc.DataChannel) {
		log.Println("pcB收到DataChannel:", dc.Label())
		dc.OnOpen(func() {
			log.Println("pcB DataChannel已打开 - Full Cone!")
			session.mu.Lock()
			session.pcBRecv = true
			session.mu.Unlock()
		})
	})

	// 消息循环
	for {
		var msg Msg
		if err := ws.ReadJSON(&msg); err != nil {
			log.Println("读取消息失败:", err)
			break
		}

		if msg.SDP != "" {
			session.handleSDP(msg.SDP)
		}
		if msg.ICECandidate != "" {
			session.handleICE(msg.ICECandidate)
		}
		if msg.ProbeAnswer != "" {
			session.handleProbeAnswer(msg.ProbeAnswer)
		}
		if msg.ProbeCandidate != "" {
			session.handleProbeCandidate(msg.ProbeCandidate)
		}
	}
}

func (s *Session) handleSDP(sdp string) {
	log.Println("收到SDP Offer")
	s.pcA.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: sdp})
	answer, _ := s.pcA.CreateAnswer(nil)
	s.pcA.SetLocalDescription(answer)
	s.ws.WriteJSON(map[string]string{"sdp": answer.SDP})
	log.Println("已发送SDP Answer")
}

func (s *Session) handleICE(candidate string) {
	s.pcA.AddICECandidate(webrtc.ICECandidateInit{Candidate: candidate})

	if strings.Contains(candidate, "srflx") && strings.Contains(candidate, "udp") {
		parts := strings.Split(candidate, " ")
		if len(parts) >= 6 {
			ip, port := parts[4], parts[5]
			if !strings.Contains(ip, ":") {
				s.mu.Lock()
				s.publicIP = ip
				s.ports[port] = true
				s.mu.Unlock()
				log.Printf("记录: IP=%s Port=%s\n", ip, port)
			}
		}
	}
}

func (s *Session) handleProbeAnswer(answer string) {
	log.Println("收到探测Answer")
	s.pcB.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer})
}

func (s *Session) handleProbeCandidate(candidate string) {
	s.pcB.AddICECandidate(webrtc.ICECandidateInit{Candidate: candidate})
}

func (s *Session) startProbe() {
	time.Sleep(1 * time.Second)

	s.mu.Lock()
	ip := s.publicIP
	portCount := len(s.ports)
	s.mu.Unlock()

	if ip == "" {
		s.sendResult("Blocked", "")
		return
	}

	if portCount > 1 {
		s.sendResult("Symmetric", ip)
		return
	}

	log.Println("开始Full Cone探测...")

	dcB, _ := s.pcB.CreateDataChannel("probe", nil)
	dcB.OnOpen(func() {
		log.Println("pcB DataChannel打开")
	})

	offer, _ := s.pcB.CreateOffer(nil)
	s.pcB.SetLocalDescription(offer)

	s.ws.WriteJSON(map[string]string{"probe-offer": offer.SDP})

	time.Sleep(4 * time.Second)

	s.mu.Lock()
	connected := s.pcBRecv
	s.mu.Unlock()

	if connected {
		s.sendResult("Full Cone", ip)
	} else {
		s.sendResult("Port Restricted Cone", ip)
	}
}

func (s *Session) sendResult(natType, ip string) {
	result := map[string]string{"nat_type": natType, "public_ip": ip}
	data, _ := json.Marshal(result)
	log.Println("发送结果:", string(data))
	s.ws.WriteJSON(result)
}
