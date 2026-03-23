import { Router, IRequest } from 'itty-router';
import { Env } from './lib/types';
import { handleHealth } from './routes/health';
import { handleCreateSession, handleGetSession } from './routes/auth';
import { handleParse } from './routes/parse';
import { handleCheckout } from './routes/checkout';
import { handleLemonSqueezyWebhook } from './routes/webhooks';
import { handleGetPurchases } from './routes/purchases';
import { handleExportLinear, handleExportJira } from './routes/export';
import { rateLimit } from './middleware/rateLimit';

const router = Router();

// Landing page
router.get('/', async () => {
  const html = LANDING_PAGE_HTML;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// Health check
router.get('/api/health', () => handleHealth());

// Auth routes
router.post('/api/auth/session', async (request: IRequest, env: Env) => {
  return handleCreateSession(request as unknown as Request, env);
});

router.get('/api/auth/session/:id', async (request: IRequest, env: Env) => {
  return handleGetSession(request.params.id, env);
});

// Parse route (protected)
router.post('/api/parse', async (request: IRequest, env: Env) => {
  return handleParse(request as unknown as Request, env);
});

// Purchase check route (protected)
router.get('/api/purchases/:userId', async (request: IRequest, env: Env) => {
  return handleGetPurchases(request as unknown as Request, request.params.userId, env);
});

// Checkout route (protected)
router.post('/api/checkout', async (request: IRequest, env: Env) => {
  return handleCheckout(request as unknown as Request, env);
});

// Webhook route (HMAC-verified, not session-auth)
router.post('/api/webhooks/ls', async (request: IRequest, env: Env) => {
  return handleLemonSqueezyWebhook(request as unknown as Request, env);
});

// Export routes (protected)
router.get('/api/export/linear', async (request: IRequest, env: Env) => {
  return handleExportLinear(request as unknown as Request, env);
});

router.get('/api/export/jira', async (request: IRequest, env: Env) => {
  return handleExportJira(request as unknown as Request, env);
});

// 404 handler
router.all('*', () => {
  return new Response(
    JSON.stringify({ error: 'not_found', message: 'Route not found.' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, env);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Add CORS headers
    const response = await router.fetch(request, env);
    const corsResponse = new Response(response.body, response);
    corsResponse.headers.set('Access-Control-Allow-Origin', '*');
    corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return corsResponse;
  },
};

const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MeetingMorph - Turn Chaotic Meeting Notes into Structured Action Items</title>
  <meta name="description" content="AI-powered meeting transcript parser for remote engineering teams. Convert messy notes into Linear and Jira action items instantly.">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    :root { --accent: #10b981; --bg-dark: #0a0a0a; --surface: #141414; }
    body { font-family: 'Inter', sans-serif; background: var(--bg-dark); color: #e5e5e5; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .glow { box-shadow: 0 0 60px rgba(16, 185, 129, 0.15); }
    .gradient-text { background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    .animate-in { animation: fadeInUp 0.6s ease-out forwards; }
    .delay-1 { animation-delay: 0.15s; opacity: 0; }
    .delay-2 { animation-delay: 0.3s; opacity: 0; }
    .delay-3 { animation-delay: 0.45s; opacity: 0; }
  </style>
</head>
<body class="min-h-screen">
  <div class="max-w-5xl mx-auto px-6 py-16">
    <header class="text-center mb-20 animate-in">
      <div class="inline-block px-4 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 text-sm mono mb-6">Built for engineering teams</div>
      <h1 class="text-5xl md:text-6xl font-bold mb-6 leading-tight">Turn chaotic meeting notes into <span class="gradient-text">structured action items</span></h1>
      <p class="text-xl text-neutral-400 max-w-2xl mx-auto">Paste your standup transcript. Get assignable tasks formatted for Linear and Jira. No bot joins your call. No per-seat subscription.</p>
    </header>

    <section class="mb-20 animate-in delay-1">
      <div class="bg-[var(--surface)] rounded-2xl p-8 glow border border-neutral-800">
        <h2 class="text-2xl font-semibold mb-4">Try it now</h2>
        <textarea id="transcript" class="w-full h-40 bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-neutral-300 mono text-sm resize-none focus:border-emerald-500 focus:outline-none transition" placeholder="Paste your meeting notes here..."></textarea>
        <div class="flex gap-3 mt-4">
          <button onclick="parseMeeting()" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold transition">Parse Action Items</button>
          <button onclick="clearResults()" class="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-medium transition">Clear</button>
        </div>
        <div id="results" class="mt-6 hidden">
          <h3 class="text-lg font-semibold mb-3 text-emerald-400">Action Items</h3>
          <div id="action-items" class="space-y-2"></div>
          <p id="summary" class="mt-4 text-sm text-neutral-500"></p>
        </div>
      </div>
    </section>

    <section class="grid md:grid-cols-3 gap-6 mb-20 animate-in delay-2">
      <div class="bg-[var(--surface)] rounded-2xl p-6 border border-neutral-800">
        <div class="text-3xl mb-3">&#x26A1;</div>
        <h3 class="text-lg font-semibold mb-2">Instant Parsing</h3>
        <p class="text-neutral-400 text-sm">Paste any meeting transcript and get structured action items in seconds. Detects assignees, priorities, and deadlines automatically.</p>
      </div>
      <div class="bg-[var(--surface)] rounded-2xl p-6 border border-neutral-800">
        <div class="text-3xl mb-3">&#x1F3AF;</div>
        <h3 class="text-lg font-semibold mb-2">Linear &amp; Jira Ready</h3>
        <p class="text-neutral-400 text-sm">Export action items in the exact format Linear and Jira expect. Copy-paste into your tracker or use the API output directly.</p>
      </div>
      <div class="bg-[var(--surface)] rounded-2xl p-6 border border-neutral-800">
        <div class="text-3xl mb-3">&#x1F6E1;&#xFE0F;</div>
        <h3 class="text-lg font-semibold mb-2">No Bot, No Subscription</h3>
        <p class="text-neutral-400 text-sm">No bot joins your calls. No per-seat pricing. One-time purchase gives your whole team permanent access.</p>
      </div>
    </section>

    <footer class="text-center text-neutral-600 text-sm animate-in delay-3">
      <p>MeetingMorph &mdash; built for remote engineering teams</p>
    </footer>
  </div>

  <script>
    async function parseMeeting() {
      const transcript = document.getElementById('transcript').value;
      if (!transcript.trim()) return;
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, format: 'json' }),
        });
        if (res.status === 401 || res.status === 402) {
          const data = await res.json();
          if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
          } else {
            alert('Please sign in to parse transcripts.');
          }
          return;
        }
        const data = await res.json();
        displayResults(data);
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    function displayResults(data) {
      const container = document.getElementById('action-items');
      const results = document.getElementById('results');
      const summary = document.getElementById('summary');
      container.innerHTML = '';
      results.classList.remove('hidden');
      if (data.actionItems && data.actionItems.length > 0) {
        data.actionItems.forEach(function(item) {
          var priorityColors = { high: 'text-red-400 bg-red-400/10', medium: 'text-yellow-400 bg-yellow-400/10', low: 'text-blue-400 bg-blue-400/10' };
          var el = document.createElement('div');
          el.className = 'flex items-start gap-3 p-3 bg-neutral-900 rounded-lg border border-neutral-800';
          el.innerHTML = '<span class="px-2 py-0.5 rounded text-xs mono ' + (priorityColors[item.priority] || '') + '">' + item.priority + '</span>' +
            '<div class="flex-1"><p class="text-sm font-medium">' + item.title + '</p>' +
            (item.assignee ? '<p class="text-xs text-neutral-500 mt-1">Assignee: ' + item.assignee + '</p>' : '') +
            (item.deadline ? '<p class="text-xs text-neutral-500">Deadline: ' + item.deadline + '</p>' : '') +
            '</div>';
          container.appendChild(el);
        });
      } else {
        container.innerHTML = '<p class="text-neutral-500 text-sm">No action items detected.</p>';
      }
      summary.textContent = data.summary || '';
    }
    function clearResults() {
      document.getElementById('transcript').value = '';
      document.getElementById('results').classList.add('hidden');
      document.getElementById('action-items').innerHTML = '';
    }
  </script>
</body>
</html>`;
