// ─── OPERATIVE HQ — Server ──────────────────────────────────────────────────
// Express + WebSocket server for Claude Code agent monitoring
// Port 2469: HTTP (hooks + static dashboard)
// WebSocket upgrades on same port at /ws
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 2469;

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  const allowedOrigin = process.env.HQ_CORS_ORIGIN || 'http://localhost:2469';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve dashboard
app.use(express.static(path.join(__dirname, 'public')));

// ─── STATE STORE ────────────────────────────────────────────────────────────

const COMMANDO_NAMES = [
  'GREEN BERET', 'SNIPER', 'SAPPER', 'SPY', 'DRIVER', 'MARINE',
  'GHOST', 'HAWK', 'VIPER', 'WOLF', 'RAVEN', 'COBRA',
  'EAGLE', 'BEAR', 'SHARK', 'PANTHER', 'FALCON', 'STORM'
];

const COMMANDO_ROLES = {
  0: 'Lead Operative',
  1: 'Code Analyst',
  2: 'Systems Engineer',
  3: 'Researcher',
  4: 'DevOps',
  5: 'UI Engineer',
};

const COMMANDO_COLORS = [
  { color: '#3a5a2a', helmet: '#c8a96e', skin: '#c8a96e' },
  { color: '#2a3a1a', helmet: '#8a8a6a', skin: '#d4aa70' },
  { color: '#5a4a2a', helmet: '#aaaaaa', skin: '#c8a96e' },
  { color: '#1a1a1a', helmet: '#1a1a1a', skin: '#c8a96e' },
  { color: '#4a3a1a', helmet: '#c0c0c0', skin: '#d4aa70' },
  { color: '#1a3a4a', helmet: '#8ab4c0', skin: '#c8a96e' },
];

const SPRITE_IDS = ['green-beret', 'sniper', 'sapper', 'spy', 'driver', 'marine'];

const state = {
  sessions: {},       // session_id → agent state
  missions: [],       // active missions
  log: [],            // event log
  stats: {
    totalHookEvents: 0,
    totalToolCalls: 0,
    totalSessions: 0,
    serverStartTime: Date.now(),
  }
};

let sessionCounter = 0;

function assignUnit(sessionId) {
  const idx = sessionCounter % COMMANDO_NAMES.length;
  const colorIdx = sessionCounter % COMMANDO_COLORS.length;
  const spriteIdx = sessionCounter % SPRITE_IDS.length;
  sessionCounter++;

  return {
    id: sessionId,
    name: COMMANDO_NAMES[idx],
    role: COMMANDO_ROLES[idx] || 'Field Agent',
    spriteId: SPRITE_IDS[spriteIdx],
    agentType: 'Claude Code',
    status: 'active',
    task: 'Deploying...',
    progress: 0,
    mapX: 15 + Math.random() * 70,
    mapY: 15 + Math.random() * 70,
    tasks: 0,
    done: 0,
    tokens: 0,
    tools: [],
    startTime: Date.now(),
    lastActivity: Date.now(),
    ...COMMANDO_COLORS[colorIdx],
  };
}

function addLog(unit, msg, type = '') {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const entry = { time, unit: unit || 'SYSTEM', msg, type };
  state.log.unshift(entry);
  if (state.log.length > 200) state.log.length = 200;
  return entry;
}

// ─── WEBSOCKET ──────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  // Send full state on connect
  ws.send(JSON.stringify({ type: 'init', state: getClientState() }));
  addLog('SYSTEM', `Dashboard connected (${clients.size} active)`);
  broadcast({ type: 'log', log: state.log.slice(0, 1) });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleDashboardCommand(msg);
    } catch (e) { /* ignore malformed */ }
  });
});

function broadcast(data) {
  const json = JSON.stringify(data);
  clients.forEach(c => {
    if (c.readyState === 1) c.send(json);
  });
}

function getClientState() {
  return {
    sessions: Object.values(state.sessions),
    missions: state.missions,
    log: state.log.slice(0, 50),
    stats: {
      ...state.stats,
      activeSessions: Object.values(state.sessions).filter(s => s.status === 'active').length,
      busySessions: Object.values(state.sessions).filter(s => s.status === 'busy').length,
      waitingSessions: Object.values(state.sessions).filter(s => s.status === 'waiting').length,
      totalSessions: Object.keys(state.sessions).length,
      uptime: Date.now() - state.stats.serverStartTime,
    }
  };
}

// ─── HOOK ENDPOINT ──────────────────────────────────────────────────────────

app.post('/hook', (req, res) => {
  const { event, session, tool, input, output, message, summary } = req.body;

  if (!session) {
    return res.status(400).json({ error: 'session required' });
  }

  state.stats.totalHookEvents++;

  // Auto-create session
  if (!state.sessions[session]) {
    state.sessions[session] = assignUnit(session);
    state.stats.totalSessions++;
    const unit = state.sessions[session];
    addLog(unit.name, `Agent deployed — ${unit.role}`, 'success');
  }

  const agent = state.sessions[session];
  agent.lastActivity = Date.now();

  switch (event) {
    case 'tool_start':
    case 'PreToolUse':
      agent.status = 'busy';
      agent.task = `Using: ${tool || 'unknown tool'}`;
      agent.tasks++;
      agent.tools.push(tool);
      state.stats.totalToolCalls++;
      if (input) agent.task += ` — ${String(input).slice(0, 60)}`;
      addLog(agent.name, `Tool: ${tool}`, '');
      // Advance progress
      agent.progress = Math.min(95, agent.progress + Math.random() * 8 + 2);
      break;

    case 'tool_end':
    case 'PostToolUse':
      agent.status = 'active';
      agent.done++;
      agent.task = `Completed: ${tool || 'tool'}`;
      addLog(agent.name, `${tool} complete (${agent.done}/${agent.tasks})`, 'success');
      agent.progress = Math.min(95, agent.progress + Math.random() * 5 + 3);
      break;

    case 'stop':
    case 'Stop':
      agent.status = 'idle';
      agent.progress = 100;
      agent.task = summary || 'Mission complete — awaiting orders';
      addLog(agent.name, 'Session complete', 'success');
      break;

    case 'notification':
    case 'Notification':
      agent.status = 'waiting';
      agent.task = `AWAITING INPUT — ${message || 'needs attention'}`;
      addLog(agent.name, `BLOCKED — ${message || 'awaiting input'}`, 'error');
      break;

    case 'error':
      agent.status = 'waiting';
      agent.task = `ERROR — ${message || 'unknown error'}`;
      addLog(agent.name, `ERROR: ${message || 'unknown'}`, 'error');
      break;

    default:
      addLog(agent.name, `Event: ${event}`, '');
      break;
  }

  // Estimate tokens (rough)
  if (input) agent.tokens += Math.ceil(String(input).length / 4);
  if (output) agent.tokens += Math.ceil(String(output).length / 4);

  broadcast({ type: 'update', state: getClientState() });
  res.json({ ok: true, agent: agent.name });
});

// ─── REST ENDPOINTS ─────────────────────────────────────────────────────────

app.get('/state', (req, res) => {
  res.json(getClientState());
});

app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    uptime: Date.now() - state.stats.serverStartTime,
    sessions: Object.keys(state.sessions).length,
    clients: clients.size,
  });
});

// Manual session creation (for testing / spawning from dashboard)
app.post('/spawn', (req, res) => {
  const { name, role, task } = req.body;
  const sessionId = `manual-${Date.now()}`;
  state.sessions[sessionId] = assignUnit(sessionId);
  const agent = state.sessions[sessionId];
  if (name) agent.name = name.toUpperCase();
  if (role) agent.role = role;
  if (task) agent.task = task;
  addLog(agent.name, `Manually deployed — ${agent.role}`, 'success');
  broadcast({ type: 'update', state: getClientState() });
  res.json({ ok: true, sessionId, agent });
});

// Remove session
app.post('/abort', (req, res) => {
  const { session } = req.body;
  if (state.sessions[session]) {
    const name = state.sessions[session].name;
    delete state.sessions[session];
    addLog(name, 'Agent session terminated', 'error');
    broadcast({ type: 'update', state: getClientState() });
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'session not found' });
  }
});

// ─── DASHBOARD COMMANDS (via WebSocket) ─────────────────────────────────────

function handleDashboardCommand(msg) {
  switch (msg.command) {
    case 'spawn':
      const sid = `dash-${Date.now()}`;
      state.sessions[sid] = assignUnit(sid);
      const a = state.sessions[sid];
      if (msg.name) a.name = msg.name.toUpperCase();
      addLog(a.name, 'Deployed from dashboard', 'success');
      break;

    case 'abort':
      if (state.sessions[msg.session]) {
        addLog(state.sessions[msg.session].name, 'Aborted from dashboard', 'error');
        delete state.sessions[msg.session];
      }
      break;

    case 'pause':
      if (state.sessions[msg.session]) {
        state.sessions[msg.session].status = 'idle';
        addLog(state.sessions[msg.session].name, 'Paused', '');
      }
      break;

    case 'resume':
      if (state.sessions[msg.session]) {
        state.sessions[msg.session].status = 'active';
        addLog(state.sessions[msg.session].name, 'Resumed', 'success');
      }
      break;
  }
  broadcast({ type: 'update', state: getClientState() });
}

// ─── START ──────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  addLog('SYSTEM', `Operative HQ online — port ${PORT}`, 'success');
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║         ☠  OPERATIVE HQ — ONLINE  ☠             ║
  ╠══════════════════════════════════════════════════╣
  ║  Dashboard:  http://localhost:${PORT}              ║
  ║  Hook URL:   http://localhost:${PORT}/hook          ║
  ║  State API:  http://localhost:${PORT}/state         ║
  ║  WebSocket:  ws://localhost:${PORT}/ws              ║
  ╚══════════════════════════════════════════════════╝
  `);
});
