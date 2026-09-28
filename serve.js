const http = require('http');

const questions = [
  'Business name',
  'What do you track on paper, in spreadsheets, or in your head?',
  'What is the most annoying repetitive task in your week?',
  'What do customers ask you that you have to look up?',
  'Anything else we should know?',
];

// three bars jumping to random levels like resource meters, solid at the base, light at the top
const logo = String.raw`(() => {
  const H = 8, bars = 'myc', el = document.getElementById('logo');
  const level = [3, 6, 2], goal = [...level];
  const draw = () => {
    let out = '';
    for (let y = 0; y < H; y++) {
      out += [...bars].map((k, i) => {
        const d = Math.round(level[i]) - (H - y);
        return d < 0 ? '   ' : '<i class=' + k + '>' + '▒▓█'[Math.min(2, d)].repeat(3) + '</i>';
      }).join(' ') + '\n';
    }
    el.innerHTML = out;
  };
  const step = () => level.forEach((v, i) => {
    if (Math.abs(goal[i] - v) < .3 || Math.random() < .05) goal[i] = 1 + Math.random() * (H - 1);
    level[i] += (goal[i] - v) * .35;
  });
  draw();
  if (!matchMedia('(prefers-reduced-motion:reduce)').matches) setInterval(() => { step(); draw(); }, 60);
})()`;

const css = `
:root{color-scheme:dark;--bg:#000;--fg:#e6e6e6;--dim:#6e6e6e;--line:#262626;--y:#ffd23f;--c:#2ee6f0;--m:#ff3fb4;--w:#f5f5f5}
*{box-sizing:border-box}
body{margin:0;overflow-wrap:anywhere;background:var(--bg);color:var(--fg);font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
main{max-width:44rem;margin:0 auto;padding:2.5rem 1rem 4rem}
.top{display:flex;gap:1.5rem;align-items:center;margin-bottom:2rem}
#logo{margin:0;min-width:11ch;font-size:14px;line-height:1}
#logo i{font-style:normal}
.y{color:var(--y)}.c{color:var(--c)}.m{color:var(--m)}.w{color:var(--w)}.dim{color:var(--dim)}
h1{margin:0;font-size:1.3rem;line-height:1.25;letter-spacing:.04em;color:var(--w)}
.l{animation:in .4s ease-out both;animation-delay:calc(.2s + var(--i) * 90ms)}
label{display:block;margin-top:1.4rem}
.f{display:flex;align-items:baseline;gap:1ch;margin-top:.3rem}
textarea{flex:1;overflow:hidden;padding:.1em 0 .3em;background:none;color:var(--fg);font:inherit;font-size:16px;border:0;border-bottom:1px solid var(--line);resize:none;caret-color:var(--y);transition:border-color .2s}
textarea:focus{outline:0;border-color:var(--c)}
button{margin-top:2rem;padding:.5em 1.1em;background:none;color:var(--c);font:inherit;border:1px solid var(--c);border-radius:4px;cursor:pointer;transition:background .15s,color .15s}
button:hover,button:focus-visible{background:var(--c);color:var(--bg);outline:0}
footer{margin-top:3.5rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--dim);font-size:13px}
footer p{margin:.2rem 0}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const page = (body, k) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resource Automation</title><style>${css}</style><main>
<div class="top"><pre id="logo" aria-hidden="true"></pre>
<div><h1>Resource<br>Automation</h1><div class="dim">plan · v1</div></div></div>
${body}
<footer>
<p># created by <span class="w">adam-ballinger</span>
<p># data encrypted in transit and at rest
<p># responses only read by adam-ballinger and anthropic coding assistant, never sold
<p># contact adam-ballinger to have your response deleted
<p># no cookies, no tracking
<p># key ${k.key} generated for ${esc(k.label)} ${k.createdAt.toISOString().slice(0, 10)} ${k.once && k.usedAt ? 'consumed ' + k.usedAt.toISOString().slice(0, 10) : 'valid for: ' + (k.once ? 'one response' : 'unlimited responses')}
</footer></main><script>${logo}</script>`;

const form = (k) => page(`<p class="l dim" style="--i:0"># a few questions to see if we can build something for you</p>
<form method="post" action="/?key=${k.key}" oninput="const t=event.target;t.style.height='auto';t.style.height=t.scrollHeight+1+'px'" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))this.requestSubmit()">
${questions.map((q, i) => `<label class="l" style="--i:${i + 1}"><span class="dim">[${i + 1}/${questions.length}]</span> <span class="m">?</span> ${q}
<span class="f"><span class="c">›</span><textarea name="q${i}" rows="1" maxlength="2000"${i ? '' : ' required'}></textarea></span></label>`).join('\n')}
<div class="l" style="--i:${questions.length + 1}"><button>send ⏎</button> <span class="dim">&nbsp;ctrl+enter</span></div></form>`, k);

const thanks = (k) => page(`<p class="l" style="--i:0"><span class="y">✓</span> saved</p>
<p class="l dim" style="--i:1"># thanks! we'll read these and get back to you.</p>`, k);

const received = (k) => page(`<p class="l" style="--i:0"><span class="y">✓</span> already received</p>
<p class="l dim" style="--i:1"># thanks! contact adam-ballinger to change your answers.</p>`, k);

module.exports = function serve(db, me) {
  const issues = db.collection('issues'), keys = db.collection('keys');
  const port = process.env.PORT || 3000;

  http.createServer(async (req, res) => {
    try {
      const key = new URL(req.url, 'http://x').searchParams.get('key');
      const k = key && await keys.findOne({ key, scopes: 'plan' });
      if (!k) return res.writeHead(404).end();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.method !== 'POST') return res.end(k.once && k.usedAt ? received(k) : form(k));
      let data = '';
      for await (const chunk of req) if ((data += chunk).length > 20000) return res.writeHead(413).end();
      const used = await keys.findOneAndUpdate({ _id: k._id, $or: [{ once: false }, { usedAt: null }] }, { $set: { usedAt: new Date() } }, { returnDocument: 'after' });
      if (!used) return res.end(received(await keys.findOne({ _id: k._id })));
      const f = new URLSearchParams(data);
      const answers = questions.map((q, i) => (f.get(`q${i}`) || '').trim().slice(0, 2000));
      await issues.insertOne({
        title: `Planning answers from ${answers[0] || k.label}`,
        body: questions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join('\n\n'),
        done: false, createdBy: me._id, keyId: k._id, createdAt: new Date(),
      }).catch(async (e) => { await keys.updateOne({ _id: k._id }, { $set: { usedAt: k.usedAt } }); throw e; });
      res.end(thanks(used));
    } catch (e) {
      console.error(e);
      res.writeHead(500).end();
    }
  }).listen(port, () => console.log(`serving on port ${port}`));
};
