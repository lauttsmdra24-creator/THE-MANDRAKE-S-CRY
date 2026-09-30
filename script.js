/* ========================================================= TOUCH DETECT ========================================================= */
if(('ontouchstart' in window) || navigator.maxTouchPoints > 0) document.body.classList.add('is-touch');

/* ========================================================= HELPERS ========================================================= */
const $ = id => document.getElementById(id);
function hash01(n){ const s = Math.sin(n*127.1+13.7)*43758.5453; return s - Math.floor(s); }
function rand(a,b){ return a + Math.random()*(b-a); }
function wrap(v,m){ return ((v % m) + m) % m; }

/* skala UI: mengikuti ukuran layar (ponsel, tablet, PC/laptop) */
function applyUI(){
  const w = window.innerWidth, h = window.innerHeight;
  const u = Math.max(0.8, Math.min(1.7, Math.min(w/400, h/760)));
  document.documentElement.style.setProperty('--u', u.toFixed(3));
}
applyUI();

/* ========================================================= AUDIO (Web Audio API) ========================================================= */
let AC = null, screamNodes = null, muted = false;
function ac(){
  if(!AC){ try{ AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
  if(AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(f,d,type,v,slide){
  if(muted) return;
  type = type || 'square'; v = (v === undefined) ? .15 : v; slide = slide || 0;
  try{
    const c = ac(); if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, c.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f+slide), c.currentTime+d);
    g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, c.currentTime+d);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime+d);
  }catch(e){}
}
function footstep(){ beep(180+Math.random()*80,.07,'square',.08,-60); }
function alertS(){ beep(880,.15,'square',.12); setTimeout(()=>beep(880,.15,'square',.12),180); }
function buryS(){ beep(120,.12,'sawtooth',.18,-40); }
function winS(){ [523,659,784,1046,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.25,'square',.14),i*140)); }
function startScream(){
  if(muted || screamNodes) return;
  try{
    const c = ac(); if(!c) return;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    const lfo = c.createOscillator(), lg = c.createGain();
    o.type='sawtooth'; o.frequency.value = 720;
    o2.type='square'; o2.frequency.value = 360;
    lfo.type='sine'; lfo.frequency.value = 9; lg.gain.value = 250;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.value = .055;
    o.connect(g); o2.connect(g); g.connect(c.destination);
    o.start(); o2.start(); lfo.start();
    screamNodes = { o:o, o2:o2, lfo:lfo };
  }catch(e){}
}
function stopScream(){
  if(!screamNodes) return;
  try{ screamNodes.o.stop(); screamNodes.o2.stop(); screamNodes.lfo.stop(); }catch(e){}
  screamNodes = null;
}
$('muteBtn').onclick = e => {
  muted = !muted;
  e.currentTarget.textContent = muted ? 'SND OFF' : 'SND ON';
  if(muted) stopScream();
  else if(playing && !buryPhase && mandState === 'danger') startScream();
};
document.addEventListener('visibilitychange', () => {
  if(document.hidden) stopScream();
  else if(playing && !muted && !buryPhase && mandState === 'danger') startScream();
});

/* ========================================================= PAGES + DOM CACHE ========================================================= */
const pages = {
  cover: $('page-cover'), loading: $('page-loading'), game: $('page-game'),
  win: $('page-win'), letter: $('page-letter')
};
const el = {
  progFill:$('progFill'), progTxt:$('progTxt'), hpFill:$('hpFill'), hpTxt:$('hpTxt'),
  timeTxt:$('timeTxt'), coverIcon:$('coverIcon'), dmgFlash:$('dmgFlash'),
  banner:$('statusBanner'), buryFill:$('buryFill'), buryTxt:$('buryTxt'),
  buryOverlay:$('buryOverlay'), overOverlay:$('overOverlay'), introOverlay:$('introOverlay'),
  touchControls:$('touchControls'), winStats:$('winStats'), loadBar:$('loadBar'), dots:$('dots')
};
function show(id){
  Object.values(pages).forEach(p => p.classList.remove('active'));
  pages[id].classList.add('active');
  el.touchControls.classList.toggle('on-game', id === 'game');
  if(id === 'cover') startCoverLoop();
  if(id === 'loading'){ drawLoadDecor(); startLoadBg(); }
  if(id === 'letter') startConfetti();
  if(id === 'win') setTimeout(() => { drawWinScene(); if(!winRAF) winRAF = requestAnimationFrame(winLoop); }, 30);
}

/* ========================================================= COVER - PIXEL JUNGLE SCENE ========================================================= */
const coverCv = $('coverCanvas');
const cctx = coverCv.getContext('2d');
let cw = 160, ch = 280, coverRAF = null;

function rect(x,y,w,h,c){
  cctx.fillStyle = c;
  cctx.fillRect(Math.round(x), Math.round(y), Math.max(1,Math.round(w)), Math.max(1,Math.round(h)));
}
function sizeCover(){
  const r = coverCv.getBoundingClientRect();
  if(r.width < 20 || r.height < 20) return false;
  const s = Math.max(3, Math.round(r.height / 290));
  cw = Math.max(90, Math.round(r.width / s));
  ch = Math.max(140, Math.round(r.height / s));
  coverCv.width = cw; coverCv.height = ch;
  cctx.imageSmoothingEnabled = false;
  return true;
}

/* particles */
const fireflies = [];
for(let i=0;i<24;i++) fireflies.push({ x:Math.random(), y:.08+Math.random()*.60, ph:Math.random()*6.283, sp:.25+Math.random()*.7 });
const motes = [];
for(let i=0;i<16;i++) motes.push({ x:Math.random(), y:Math.random()*.8, ph:Math.random()*6.283, sp:.15+Math.random()*.35 });

/* blocky pixel tree band */
function treeBand(color, gy, count, hf, seed){
  const step = cw/count;
  for(let i=0;i<count;i++){
    const h0 = ch*hf*(0.62 + hash01(i*1.7+seed)*0.5);
    const x = i*step + hash01(i*3.1+seed)*step*0.55 + step*0.22;
    const baseY = gy + 2;
    const cwid = h0*0.55;
    rect(x-1.5, baseY-h0*0.62, 3, h0*0.62, color);
    rect(x-cwid/2, baseY-h0*0.98, cwid, h0*0.42, color);
    rect(x-cwid*0.34, baseY-h0*1.13, cwid*0.68, h0*0.20, color);
    rect(x-cwid*0.78, baseY-h0*0.86, cwid*0.30, h0*0.17, color);
    rect(x+cwid*0.48, baseY-h0*0.86, cwid*0.30, h0*0.17, color);
  }
}
/* pixel Z */
function pixelZ(x,y,s,col,alpha){
  cctx.globalAlpha = alpha;
  cctx.fillStyle = col;
  cctx.fillRect(Math.round(x), Math.round(y), s*3, s);
  cctx.fillRect(Math.round(x+s*2), Math.round(y+s), s, s);
  cctx.fillRect(Math.round(x+s), Math.round(y+s*2), s, s);
  cctx.fillRect(Math.round(x), Math.round(y+s*3), s*3, s);
  cctx.globalAlpha = 1;
}
/* cover mandrake */
function coverMandrake(x, gy, t){
  const p = (t % 11) / 11;
  let mode = 'idle';
  if(p > 0.46 && p <= 0.56) mode = 'turn';
  else if(p > 0.56 && p <= 0.70) mode = 'scream';
  else if(p > 0.70 && p <= 0.79) mode = 'turn';
  const bob = Math.sin(t*3)*1;
  const y = gy + bob;
  const sway = Math.sin(t*1.6)*1.2;
  /* roots */
  cctx.strokeStyle = '#4a1c0a';
  cctx.lineWidth = 2;
  cctx.lineCap = 'round';
  for(let i=-1;i<=1;i+=2){
    cctx.beginPath();
    cctx.moveTo(x+i*5, y-16);
    cctx.quadraticCurveTo(x+i*7+sway, y-8, x+i*9, y);
    cctx.stroke();
  }
  /* arms */
  cctx.lineWidth = 2.4;
  if(mode === 'scream'){
    cctx.beginPath(); cctx.moveTo(x-9,y-30); cctx.lineTo(x-16, y-43+Math.sin(t*14)*1.5); cctx.stroke();
    cctx.beginPath(); cctx.moveTo(x+9,y-30); cctx.lineTo(x+16, y-43-Math.sin(t*14)*1.5); cctx.stroke();
  } else {
    cctx.beginPath(); cctx.moveTo(x-9,y-30); cctx.lineTo(x-15, y-21); cctx.stroke();
    cctx.beginPath(); cctx.moveTo(x+9,y-30); cctx.lineTo(x+15, y-21); cctx.stroke();
  }
  /* body */
  rect(x-10, y-38, 20, 22, '#b06a30');
  rect(x-10, y-32, 20, 2.5, '#6b2d1a');
  rect(x-10, y-25, 20, 2.5, '#6b2d1a');
  rect(x-11, y-38, 3, 22, '#8a4d20');
  rect(x+8, y-38, 3, 22, '#8a4d20');
  /* leaves */
  rect(x-13, y-44, 12, 4, '#3fae2a');
  rect(x+1, y-44, 12, 4, '#3fae2a');
  rect(x-10, y-48, 8, 4, '#57cf39');
  rect(x+2, y-48, 8, 4, '#57cf39');
  rect(x-1, y-46, 2, 8, '#2f8a1f');
  /* face */
  if(mode === 'idle'){
    rect(x+1, y-31, 3, 3, '#1a0a04');
    rect(x-1, y-23, 5, 1.5, '#1a0a04');
    pixelZ(x+14, y-46, 1.6, '#eafff0', .9);
    pixelZ(x+20, y-54, 1.2, '#eafff0', .6);
  } else if(mode === 'turn'){
    rect(x-4, y-31, 3, 3, '#1a0a04');
    rect(x+1, y-31, 3, 3, '#1a0a04');
    rect(x-2, y-23, 4, 2, '#1a0a04');
  } else {
    rect(x-7, y-34, 6, 6, '#ffffff');
    rect(x+1, y-34, 6, 6, '#ffffff');
    rect(x-6, y-33, 4, 4, '#000000');
    rect(x+2, y-33, 4, 4, '#000000');
    rect(x-5, y-27, 10, 8, '#1a0000');
    rect(x-3, y-25, 6, 5, '#ff5a5a');
    cctx.globalAlpha = .55;
    cctx.fillStyle = '#ffe14d';
    cctx.fillRect(Math.round(x-8), Math.round(y-35), 8, 8);
    cctx.fillRect(Math.round(x), Math.round(y-35), 8, 8);
    cctx.globalAlpha = 1;
    for(let i=0;i<3;i++){
      const r = 18 + wrap(t*40 + i*12, 36);
      const a = Math.max(0, 1 - r/54);
      cctx.strokeStyle = 'rgba(255,255,255,'+(a*0.7)+')';
      cctx.lineWidth = 1.2;
      cctx.beginPath(); cctx.arc(x, y-28, r, -0.9, 0.9); cctx.stroke();
      cctx.beginPath(); cctx.arc(x, y-28, r, Math.PI-0.9, Math.PI+0.9); cctx.stroke();
    }
  }
}
/* cover farmer */
function coverFarmer(x, gy, t, moving){
  const swing = moving ? Math.sin(t*8)*2 : 0;
  const bob = moving ? Math.abs(Math.sin(t*8))*1.5 : 0;
  const y = gy - bob;
  rect(x-4+swing, y-8, 3, 8, '#4a3d28');
  rect(x+1-swing, y-8, 3, 8, '#4a3d28');
  rect(x-5, y-18, 10, 11, '#e8e0cc');
  rect(x-4, y-16, 8, 9, '#5a7d9a');
  rect(x-7, y-17, 3, 7, '#ffca9a');
  rect(x+4, y-17, 3, 7, '#ffca9a');
  rect(x-4, y-25, 8, 7, '#ffca9a');
  rect(x-2, y-22, 1.5, 1.5, '#241208');
  rect(x+1, y-22, 1.5, 1.5, '#241208');
  rect(x-6, y-27, 12, 2, '#a67c52');
  rect(x-3, y-31, 6, 4, '#8a623d');
  rect(x-9, y-15, 4, 5, '#b07a3a');
}
function drawCover(t){
  const W = cw, H = ch;
  const gy = Math.round(H*0.70);
  const K = Math.max(1, W/(H*0.57));
  const base = Math.min(W, Math.round(H*0.62));
  const ox = (W-base)/2;
  /* sky */
  const g = cctx.createLinearGradient(0,0,0,gy);
  g.addColorStop(0,'#07211a'); g.addColorStop(.40,'#104a3c');
  g.addColorStop(.75,'#2a7352'); g.addColorStop(1,'#4f9a4a');
  cctx.fillStyle = g;
  cctx.fillRect(0,0,W,gy+2);
  /* sun glow */
  const sunX = W*0.74, sunY = gy*0.28;
  cctx.globalAlpha = .20; cctx.fillStyle = '#ffe9a3';
  cctx.beginPath(); cctx.arc(sunX, sunY, H*0.16, 0, 6.3); cctx.fill();
  cctx.globalAlpha = .10;
  cctx.beginPath(); cctx.arc(sunX, sunY, H*0.29, 0, 6.3); cctx.fill();
  cctx.globalAlpha = 1;
  /* light rays */
  cctx.save();
  cctx.globalAlpha = .055; cctx.fillStyle = '#fff8d0';
  const nr = Math.ceil(W/60)+1;
  for(let i=0;i<nr;i++){
    const x = wrap(i*61 + t*5, W+140) - 70;
    cctx.beginPath();
    cctx.moveTo(x,0); cctx.lineTo(x+13,0);
    cctx.lineTo(x+13-H*.55, gy); cctx.lineTo(x-H*.55, gy);
    cctx.closePath(); cctx.fill();
  }
  cctx.restore();
  /* trees */
  treeBand('#0b2f26', gy, Math.round(7*K), .52, 1.0);
  treeBand('#134a3c', gy, Math.round(6*K), .68, 4.0);
  treeBand('#1b6349', gy, Math.round(5*K), .84, 7.0);
  /* hanging vines */
  cctx.strokeStyle = '#2f8a4a';
  cctx.lineWidth = 1.6;
  cctx.lineCap = 'round';
  const nv = Math.round(7*K);
  for(let i=0;i<nv;i++){
    const x = ((i+0.5)*W/nv) % W;
    const len = 9 + hash01(i*3.3)*20;
    const sw = Math.sin(t*1.1 + i)*1.8;
    cctx.beginPath();
    cctx.moveTo(x,0);
    cctx.quadraticCurveTo(x+3+sw, len*0.5, x+sw, len);
    cctx.stroke();
    rect(x-1+sw, len-2, 3, 2, '#57cf39');
    rect(x-3, len*0.62, 3, 2, '#3fae2a');
    rect(x+1, len*0.32, 3, 2, '#3fae2a');
  }
  /* ground */
  const gg = cctx.createLinearGradient(0,gy,0,H);
  gg.addColorStop(0,'#3d8a3a'); gg.addColorStop(.35,'#2a6b30'); gg.addColorStop(1,'#0f2f19');
  cctx.fillStyle = gg;
  cctx.fillRect(0, gy, W, H-gy);
  for(let i=0;i<Math.ceil(W/3);i++){
    const x = i*3 + hash01(i*1.9)*2;
    const hh = 1 + hash01(i*7.7)*3;
    rect(x, gy-hh, 1, hh, i%2 ? '#5fb44a' : '#4a9a3c');
  }
  /* bushes */
  for(let i=0;i<Math.ceil(W/22);i++){
    const x = i*22 + hash01(i*5.5)*10 - 6;
    rect(x, gy-4, 16, 5, '#2f7a3c');
    rect(x+3, gy-7, 10, 4, '#3d9a46');
    rect(x+5, gy-9, 6, 3, '#54b455');
  }
  /* mandrake */
  coverMandrake(ox+base*0.78, gy+2, t);
  /* farmer strolling */
  const walkPhase = (t*0.22) % 2;
  const fpos = walkPhase < 1 ? walkPhase : (2 - walkPhase);
  const fx = ox + base*0.10 + fpos * (base*0.34);
  coverFarmer(fx, gy+4, t, true);
  /* fireflies */
  for(let i=0;i<fireflies.length;i++){
    const f = fireflies[i];
    const px = f.x*W + Math.sin(t*f.sp + f.ph)*7;
    const py = f.y*H + Math.cos(t*f.sp*0.8 + f.ph)*4;
    const a = 0.35 + 0.55*Math.abs(Math.sin(t*2 + f.ph));
    cctx.globalAlpha = a*0.35; cctx.fillStyle = '#d9ff8a';
    cctx.fillRect(Math.round(px-1), Math.round(py-1), 3, 3);
    cctx.globalAlpha = a; cctx.fillStyle = '#fdffd0';
    cctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    cctx.globalAlpha = 1;
  }
  /* floating motes */
  for(let i=0;i<motes.length;i++){
    const m = motes[i];
    const px = wrap(m.x*W + Math.sin(t*m.sp + m.ph)*10 + t*3, W+10) - 5;
    const py = m.y*H + Math.sin(t*m.sp*1.4 + m.ph)*6;
    cctx.globalAlpha = 0.35 + 0.3*Math.sin(t*1.5 + m.ph);
    cctx.fillStyle = i%3===0 ? '#a8ff7a' : '#7dd86a';
    cctx.fillRect(Math.round(px), Math.round(py), 2, 1);
    cctx.globalAlpha = 1;
  }
}
function coverLoop(ts){
  if(!pages.cover.classList.contains('active')){ coverRAF = null; return; }
  if(!coverCv.width) sizeCover();
  drawCover(ts/1000);
  coverRAF = requestAnimationFrame(coverLoop);
}
function startCoverLoop(){
  sizeCover();
  if(!coverRAF) coverRAF = requestAnimationFrame(coverLoop);
}

/* ========================================================= PIXEL STARS (no emoji) ========================================================= */
const STAR_ROWS = ['....X....','....X....','..XXXXX..','...XXX...','XXXXXXXXX','.XXXXXXX.','..XXXXX..','..X...X..','.X.....X.'];
function drawPixelStars(cvs, filled, total, u){
  const gap = u*2, starW = 9*u, starH = STAR_ROWS.length*u;
  cvs.width = total*starW + (total-1)*gap;
  cvs.height = starH;
  cvs.style.width = cvs.width + 'px';
  cvs.style.height = cvs.height + 'px';
  const c = cvs.getContext('2d');
  c.clearRect(0,0,cvs.width,cvs.height);
  for(let s=0;s<total;s++){
    const ox = s*(starW+gap);
    const on = s < filled;
    c.fillStyle = on ? '#ffd83a' : 'rgba(0,0,0,.30)';
    for(let r=0;r<STAR_ROWS.length;r++){
      for(let col=0;col<9;col++){
        if(STAR_ROWS[r][col] === 'X') c.fillRect(ox+col*u, r*u, u, u);
      }
    }
    if(on){ c.fillStyle = 'rgba(255,255,255,.65)'; c.fillRect(ox+4*u, u, u, u); }
  }
}

/* ========================================================= LOADING PAGE ========================================================= */
let loadProg = 0, loadTimer = null;
const loadCanvas = $('loadCanvas');
const lctx = loadCanvas.getContext('2d');
lctx.imageSmoothingEnabled = false;

function drawMiniMandrake(frame, prog){
  const c = lctx;
  c.clearRect(0,0,64,88);
  const t = frame*0.35;
  const wig = Math.sin(t)*5;
  const strain = prog/100;
  /* leaves */
  c.fillStyle = '#2d7a1f';
  c.fillRect(30, 1, 4, 9);
  c.fillStyle = '#3fae2a';
  c.fillRect(16, 3, 14, 5);
  c.fillRect(34, 3, 14, 5);
  c.fillStyle = '#57cf39';
  c.fillRect(20, 0, 9, 4);
  c.fillRect(36, 0, 9, 4);
  /* body */
  c.fillStyle = '#c47a3a';
  c.fillRect(18, 12, 28, 26);
  c.fillStyle = '#8a4d20';
  c.fillRect(18, 12, 4, 26);
  c.fillRect(42, 12, 4, 26);
  c.fillStyle = '#5a1f0f';
  c.fillRect(18, 21, 28, 3);
  c.fillRect(18, 30, 28, 3);
  /* face */
  c.fillStyle = '#1a0a04';
  if(prog >= 100){
    c.fillRect(24, 16, 4, 2);
    c.fillRect(36, 16, 4, 2);
    c.fillRect(28, 25, 8, 2); /* sleepy smile */
  } else {
    c.fillRect(24, 15, 4, 4);
    c.fillRect(36, 15, 4, 4);
    c.fillRect(27, 24, 10, 4); /* gritted mouth */
    c.fillStyle = '#ffffff';
    c.fillRect(27, 24, 2, 1);
    c.fillRect(31, 24, 2, 1);
    c.fillRect(35, 24, 2, 1);
  }
  /* root arms reaching */
  c.strokeStyle = '#5a1f0f';
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(18, 18); c.quadraticCurveTo(8, 12+wig, 3, 20+wig); c.stroke();
  c.beginPath(); c.moveTo(46, 18); c.quadraticCurveTo(56, 12-wig, 61, 20-wig); c.stroke();
  /* dangling roots tangling into the bar */
  for(let i=0;i<5;i++){
    const bx = 17 + i*7;
    const len = 34 + (i%2)*8;
    for(let yy=38; yy<88 && yy<38+len; yy+=4){
      const sway = Math.sin(t*1.6 + i*1.7 + yy*0.12) * (yy-34) * 0.09 * (0.4 + strain*0.8);
      c.fillStyle = i%2 ? '#8a5a2e' : '#6b3d1c';
      c.fillRect(Math.round(bx + sway), yy, 4, 4);
    }
  }
}

/* rumput loading: digambar penuh selebar kartu, otomatis menyesuaikan layar */
function drawLoadDecor(){
  const c = $('loadDecor');
  const pw = c.parentElement.clientWidth;
  if(pw < 20) return;
  const uu = parseFloat(document.documentElement.style.getPropertyValue('--u')) || 1;
  const px = Math.max(3, Math.round(3*uu));
  const W = Math.max(40, Math.round(pw/px)), H = 26;
  c.width = W; c.height = H;
  c.style.width = pw + 'px';
  c.style.height = (H*px) + 'px';
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0,0,W,H);
  const gy = 21;
  /* tanah */
  x.fillStyle = '#2a6b30'; x.fillRect(0, gy, W, H-gy);
  x.fillStyle = '#3d8a3a'; x.fillRect(0, gy, W, 2);
  x.fillStyle = '#1f5526'; x.fillRect(0, H-2, W, 2);
  /* helai rumput sepanjang lebar */
  for(let i=0;i<W;i+=2){
    const h = 3 + Math.floor(hash01(i*1.7)*8);
    const m = i % 6;
    x.fillStyle = m===0 ? '#2f8a1f' : (m===2 ? '#3fae2a' : '#57cf39');
    x.fillRect(i, gy-h, 2, h+1);
  }
  /* semak & bunga tersebar rata dari kiri ke kanan */
  const step = 26;
  const n = Math.max(1, Math.floor(W/step));
  const start = Math.round((W - (n-1)*step)/2) - 6;
  for(let k=0;k<n;k++){
    const bx = start + k*step;
    x.fillStyle = '#3d9a46'; x.fillRect(bx, gy-8, 12, 7);
    x.fillStyle = '#54b455'; x.fillRect(bx+2, gy-12, 8, 5);
    x.fillStyle = '#8ac154'; x.fillRect(bx+4, gy-15, 4, 4);
    x.fillStyle = '#a8e06a'; x.fillRect(bx+5, gy-15, 2, 2);
    const fx = bx + 15;
    if(k < n-1 || n === 1){
      x.fillStyle = '#2f8a1f'; x.fillRect(fx, gy-10, 1, 10);
      x.fillStyle = k%2 ? '#ffd83a' : '#ff8fb0';
      x.fillRect(fx-1, gy-13, 3, 3);
      x.fillStyle = '#fff'; x.fillRect(fx, gy-12, 1, 1);
    }
  }
}

/* ===== latar hutan animasi untuk loading screen ===== */
const lbCv = $('loadBg');
const lbx = lbCv.getContext('2d');
let lbRAF = null, lbW = 160, lbH = 280, lbS = 3;
const lbFlies = [];
for(let i=0;i<34;i++) lbFlies.push({ x:Math.random(), y:.08+Math.random()*.72, ph:Math.random()*6.283, sp:.25+Math.random()*.7 });
const lbLeaves = [];
for(let i=0;i<14;i++) lbLeaves.push({ x:Math.random(), y:Math.random(), ph:Math.random()*6.283, sp:.4+Math.random()*.6 });

function sizeLoadBg(){
  const r = lbCv.getBoundingClientRect();
  if(r.width < 20 || r.height < 20) return false;
  lbS = Math.max(3, Math.round(r.height / 290));
  lbW = Math.max(90, Math.round(r.width / lbS));
  lbH = Math.max(140, Math.round(r.height / lbS));
  lbCv.width = lbW; lbCv.height = lbH;
  lbx.imageSmoothingEnabled = false;
  return true;
}
function lbRect(x,y,w,h,c){
  lbx.fillStyle = c;
  lbx.fillRect(Math.round(x), Math.round(y), Math.max(1,Math.round(w)), Math.max(1,Math.round(h)));
}
function lbTrees(color, gy, count, hf, seed){
  const step = lbW/count;
  for(let i=0;i<count;i++){
    const h0 = lbH*hf*(0.62 + hash01(i*1.7+seed)*0.5);
    const x = i*step + hash01(i*3.1+seed)*step*0.55 + step*0.22;
    const baseY = gy + 2, cwid = h0*0.55;
    lbRect(x-1.5, baseY-h0*0.62, 3, h0*0.62, color);
    lbRect(x-cwid/2, baseY-h0*0.98, cwid, h0*0.42, color);
    lbRect(x-cwid*0.34, baseY-h0*1.13, cwid*0.68, h0*0.20, color);
    lbRect(x-cwid*0.78, baseY-h0*0.86, cwid*0.30, h0*0.17, color);
    lbRect(x+cwid*0.48, baseY-h0*0.86, cwid*0.30, h0*0.17, color);
  }
}
function drawLoadBg(t){
  const W = lbW, H = lbH, c = lbx;
  const decorH = $('loadDecor').offsetHeight || 78;
  const gy = Math.max(60, Math.round((lbCv.clientHeight - decorH*0.8) / lbS));
  const K = Math.max(1, W/(H*0.57));
  /* langit hutan */
  const g = c.createLinearGradient(0,0,0,gy);
  g.addColorStop(0,'#07211a'); g.addColorStop(.45,'#104a3c');
  g.addColorStop(.80,'#2a7352'); g.addColorStop(1,'#4f9a4a');
  c.fillStyle = g; c.fillRect(0,0,W,gy+2);
  /* cahaya matahari */
  const sx = W*0.5, sy = gy*0.30;
  c.globalAlpha = .18; c.fillStyle = '#ffe9a3';
  c.beginPath(); c.arc(sx, sy, H*0.17, 0, 6.3); c.fill();
  c.globalAlpha = .09;
  c.beginPath(); c.arc(sx, sy, H*0.32, 0, 6.3); c.fill();
  c.globalAlpha = 1;
  /* sinar cahaya bergerak */
  c.save(); c.globalAlpha = .06; c.fillStyle = '#fff8d0';
  const nr = Math.ceil(W/60)+1;
  for(let i=0;i<nr;i++){
    const x = wrap(i*61 + t*6, W+140) - 70;
    c.beginPath(); c.moveTo(x,0); c.lineTo(x+14,0); c.lineTo(x+14-H*.55, gy); c.lineTo(x-H*.55, gy);
    c.closePath(); c.fill();
  }
  c.restore();
  /* pohon berlapis */
  lbTrees('#0b2f26', gy, Math.round(7*K), .52, 1.0);
  lbTrees('#134a3c', gy, Math.round(6*K), .68, 4.0);
  lbTrees('#1b6349', gy, Math.round(5*K), .84, 7.0);
  /* sulur */
  c.strokeStyle = '#2f8a4a'; c.lineWidth = 1.6; c.lineCap = 'round';
  const nv = Math.round(8*K);
  for(let i=0;i<nv;i++){
    const x = ((i+0.5)*W/nv) % W;
    const len = 9 + hash01(i*3.3)*24;
    const sw = Math.sin(t*1.1 + i)*1.8;
    c.beginPath(); c.moveTo(x,0); c.quadraticCurveTo(x+3+sw, len*0.5, x+sw, len); c.stroke();
    lbRect(x-1+sw, len-2, 3, 2, '#57cf39');
    lbRect(x-3, len*0.62, 3, 2, '#3fae2a');
  }
  /* tanah di bawah pohon */
  const gg = c.createLinearGradient(0,gy,0,H);
  gg.addColorStop(0,'#2a6b30'); gg.addColorStop(1,'#0f2f19');
  c.fillStyle = gg; c.fillRect(0, gy, W, H-gy);
  /* kunang-kunang */
  for(let i=0;i<lbFlies.length;i++){
    const f = lbFlies[i];
    const px = f.x*W + Math.sin(t*f.sp + f.ph)*8;
    const py = f.y*gy + Math.cos(t*f.sp*0.8 + f.ph)*5;
    const a = 0.35 + 0.55*Math.abs(Math.sin(t*2 + f.ph));
    c.globalAlpha = a*0.35; c.fillStyle = '#d9ff8a';
    c.fillRect(Math.round(px-1), Math.round(py-1), 3, 3);
    c.globalAlpha = a; c.fillStyle = '#fdffd0';
    c.fillRect(Math.round(px), Math.round(py), 1, 1);
    c.globalAlpha = 1;
  }
  /* daun melayang */
  for(let i=0;i<lbLeaves.length;i++){
    const l = lbLeaves[i];
    const px = wrap(l.x*W + t*(6+l.sp*6) + Math.sin(t*l.sp + l.ph)*6, W+10) - 5;
    const py = wrap(l.y*gy + t*(4+l.sp*5), gy);
    c.globalAlpha = .75;
    c.fillStyle = i%2 ? '#7dd86a' : '#a8ff7a';
    c.fillRect(Math.round(px), Math.round(py), 2, 1);
    c.fillRect(Math.round(px)+1, Math.round(py)+1, 2, 1);
    c.globalAlpha = 1;
  }
}
function loadBgLoop(ts){
  if(!pages.loading.classList.contains('active')){ lbRAF = null; return; }
  drawLoadBg(ts/1000);
  lbRAF = requestAnimationFrame(loadBgLoop);
}
function startLoadBg(){
  sizeLoadBg();
  if(!lbRAF) lbRAF = requestAnimationFrame(loadBgLoop);
}
const LOAD_TIPS = [
  'TIP: GREEN = RUN RIGHT!',
  'TIP: RED = COVER YOUR EARS!',
  'TIP: JUMP OVER WOODEN TRAPS',
  'TIP: HP RECOVERS WHILE SAFE',
  'TIP: MASH BURY AT THE END!'
];
let tipI = 0;

$('btnStart').onclick = () => {
  ac(); beep(523,.12); setTimeout(()=>beep(784,.15),130);
  show('loading');
  loadProg = 0;
  let f = 0;
  tipI = Math.floor(Math.random()*LOAD_TIPS.length);
  $('loadTip').textContent = LOAD_TIPS[tipI++ % LOAD_TIPS.length];
  $('loadPct').textContent = '0%';
  clearInterval(loadTimer);
  loadTimer = setInterval(() => {
    f++;
    loadProg += Math.random()*14 + 4;
    if(loadProg >= 100) loadProg = 100;
    el.loadBar.style.width = loadProg + '%';
    loadCanvas.style.left = 'min(max(0px, calc(' + loadProg + '% - 32px)), calc(100% - 64px))';
    drawMiniMandrake(f, loadProg);
    $('loadPct').textContent = Math.floor(loadProg) + '%';
    if(f % 6 === 0) $('loadTip').textContent = LOAD_TIPS[tipI++ % LOAD_TIPS.length];
    el.dots.textContent = '.'.repeat(1 + (f % 3));
    if(loadProg >= 100){
      clearInterval(loadTimer);
      setTimeout(() => {
        show('game');
        resetGame();
        el.introOverlay.style.display = 'flex';
      }, 600);
    }
  }, 180);
};

/* ========================================================= GAME CORE ========================================================= */
const cv = $('gameCanvas');
const ctx = cv.getContext('2d');

function resize(){
  const r = cv.parentElement.getBoundingClientRect();
  if(r.width < 10 || r.height < 10) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * d);
  cv.height = Math.round(r.height * d);
  ctx.setTransform(d,0,0,d,0,0);
  ctx.imageSmoothingEnabled = false;
}
function onResize(){
  applyUI();
  resize();
  sizeCover();
  if(pages.win.classList.contains('active')) drawWinScene();
  if(pages.loading.classList.contains('active')){ drawLoadDecor(); sizeLoadBg(); }
  if(pages.letter.classList.contains('active')) sizeConfetti();
  if(pages.game.classList.contains('active') && !playing) draw(0.016, false, false, performance.now()/1000);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
if(window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv.parentElement);
setTimeout(resize, 120);

const MAND_X = 3200, WORLD = MAND_X + 260, GOAL_X = MAND_X - 75;   /* perjalanan diperpanjang */
const JUMP_V = 600, GRAV = 1700;
const OBS = { log:{w:46,h:28}, stakes:{w:58,h:36} };
function makeObstacles(){
  return [[520,'log'],[860,'stakes'],[1180,'log'],[1480,'stakes'],[1760,'log'],[1990,'stakes'],[2210,'log'],[2470,'stakes'],[2680,'log'],[2900,'stakes']]
    .map(a => ({ x:a[0], t:a[1] }));
}
let obstacles = makeObstacles();
let jumpY = 0, jumpV = 0, jumpBuf = 0, hurtT = 0;

/* state */
let farmerX = 60, HP = 100, elapsed = 0, playing = false;
let camX = 0, camSnap = true;
let mandState = 'safe', stateT = 3, walkFrame = 0, stepT = 0;
let buryPhase = false, buryProg = 0, shakeT = 0, gameOver = false, lastTs = 0;
let keys = { left:false, right:false, duck:false };
let tState = { left:false, right:false, duck:false };

/* keyboard (PC / laptop) */
window.addEventListener('keydown', e => {
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right = true;
  if(e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') keys.left = true;
  if(e.key==='ArrowDown' ||e.key==='s'||e.key==='S') keys.duck = true;
  if(e.key===' ' && !e.repeat && buryPhase === true) doBury();
  else if(!e.repeat && (e.key==='ArrowUp'||e.key==='w'||e.key==='W'||e.key===' ')) jumpBuf = .14;
  if(e.repeat) return;
  if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') beep(300,.08,'sine',.1);
});
window.addEventListener('keyup', e => {
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') keys.right = false;
  if(e.key==='ArrowLeft' ||e.key==='a'||e.key==='A') keys.left = false;
  if(e.key==='ArrowDown' ||e.key==='s'||e.key==='S') keys.duck = false;
});
window.addEventListener('blur', () => { keys.left = keys.right = keys.duck = false; });

/* touch buttons (phone / tablet) */
function bindHold(elx, prop){
  const on = e => { e.preventDefault(); ac(); tState[prop] = true; elx.classList.add('held'); };
  const off = e => { e.preventDefault(); tState[prop] = false; elx.classList.remove('held'); };
  elx.addEventListener('pointerdown', on);
  elx.addEventListener('pointerup', off);
  elx.addEventListener('pointerleave', off);
  elx.addEventListener('pointercancel', off);
  elx.addEventListener('touchstart', on, {passive:false});
  elx.addEventListener('touchend', off, {passive:false});
  elx.addEventListener('touchcancel', off, {passive:false});
  elx.addEventListener('contextmenu', e => e.preventDefault());
}
bindHold($('tLeft'), 'left');
bindHold($('tRight'), 'right');
bindHold($('tCover'), 'duck');
function bindTap(elx, fn){
  const on = e => { e.preventDefault(); ac(); elx.classList.add('held'); fn(); };
  const off = e => { e.preventDefault(); elx.classList.remove('held'); };
  elx.addEventListener('pointerdown', on);
  elx.addEventListener('pointerup', off);
  elx.addEventListener('pointerleave', off);
  elx.addEventListener('pointercancel', off);
  elx.addEventListener('touchstart', on, {passive:false});
  elx.addEventListener('touchend', off, {passive:false});
  elx.addEventListener('touchcancel', off, {passive:false});
  elx.addEventListener('contextmenu', e => e.preventDefault());
}
bindTap($('tJump'), () => { jumpBuf = .14; });

function resetGame(){
  farmerX = 60; HP = 100; elapsed = 0; walkFrame = 0; stepT = 0; camSnap = true;
  jumpY = 0; jumpV = 0; jumpBuf = 0; hurtT = 0; obstacles = makeObstacles();
  buryPhase = false; buryProg = 0; shakeT = 0; gameOver = false; playing = false;
  stopScream();
  mandState = 'safe'; stateT = rand(2.5, 4);
  el.buryOverlay.style.display = 'none';
  el.overOverlay.style.display = 'none';
  el.buryFill.style.width = '0%';
  el.buryTxt.textContent = '0%';
  el.dmgFlash.style.opacity = 0;
  el.coverIcon.classList.add('hidden');
  setBanner();
  resize();
  draw(0.016, false, false, 0);
  lastTs = performance.now();
}

$('btnGo').onclick = () => {
  ac(); beep(784,.15);
  el.introOverlay.style.display = 'none';
  playing = true;
  lastTs = performance.now();
  requestAnimationFrame(loop);
};
$('btnRetry').onclick = () => {
  beep(500,.12);
  resetGame();
  el.introOverlay.style.display = 'none';
  playing = true;
  lastTs = performance.now();
  requestAnimationFrame(loop);
};

function doBury(){
  if(buryPhase !== true || gameOver) return;
  ac();
  buryS();
  buryProg = Math.min(100, buryProg + rand(7,11));
  shakeT = .1;
  el.buryFill.style.width = buryProg + '%';
  el.buryTxt.textContent = Math.floor(buryProg) + '%';
  if(navigator.vibrate) navigator.vibrate(15);
  if(buryProg >= 100) finishBury();
}
$('btnBury').addEventListener('pointerdown', e => { e.preventDefault(); doBury(); });

function finishBury(){
  buryPhase = 'done';
  stopScream();
  winS();
  el.buryOverlay.style.display = 'none';
  el.banner.textContent = 'MANDRAKE SLEEPING... SHHH';
  el.banner.style.background = '#a78bfa';
  el.banner.style.color = '#1a0f2e';
  el.banner.classList.remove('shaking');
  if(navigator.vibrate) navigator.vibrate([60,40,60]);
  setTimeout(() => {
    playing = false;
    const t = Math.floor(elapsed);
    const score = Math.round(HP*10 + Math.max(0, 160-t)*5);
    el.winStats.textContent = 'TIME ' + t + 's \u2022 HP ' + Math.ceil(HP) + ' \u2022 SCORE ' + score;
    let stars = 1;
    if(HP > 50 && t < 100) stars = 2;
    if(HP > 70 && t < 70) stars = 3;
    drawPixelStars($('starCanvas'), stars, 3, 3);
    show('win');
  }, 1600);
}

function setBanner(){
  const b = el.banner;
  if(buryPhase) return;
  b.classList.remove('shaking');
  if(mandState === 'safe'){
    b.textContent = '\u00BB SAFE! RUN RIGHT \u00AB';
    b.style.background = '#4ade80';
    b.style.color = '#0f2f0a';
  } else if(mandState === 'warn'){
    b.textContent = "!! IT'S TURNING... GET READY !!";
    b.style.background = '#facc15';
    b.style.color = '#000';
  } else {
    b.textContent = 'SCREAM! COVER EARS - HOLD DUCK!';
    b.style.background = '#ef4444';
    b.style.color = '#fff';
    b.classList.add('shaking');
    setTimeout(() => b.classList.remove('shaking'), 400);
  }
}

function loop(ts){
  if(!playing) return;
  let dt = (ts - lastTs)/1000;
  if(!(dt > 0)) dt = 0;
  if(dt > .05) dt = .05;
  lastTs = ts;
  elapsed += dt;

  const moveR = keys.right || tState.right;
  const moveL = keys.left || tState.left;
  const duck = (keys.duck || tState.duck) && jumpY <= 0;
  const prog = Math.min(1, farmerX / GOAL_X);

  /* ---- mandrake state machine ---- */
  if(!buryPhase){
    stateT -= dt;
    if(stateT <= 0){
      if(mandState === 'safe'){
        mandState = 'warn'; stateT = .8; alertS();
      } else if(mandState === 'warn'){
        mandState = 'danger';
        stateT = rand(1.8, 2.6) + prog*1.2;
        startScream();
        if(navigator.vibrate) navigator.vibrate(80);
      } else {
        mandState = 'safe';
        stateT = Math.max(1.4, rand(2.2, 3.8) - prog*0.8);
        stopScream();
      }
      setBanner();
    }
  }

  /* ---- movement + damage ---- */
  let moving = false;
  if(!buryPhase && !gameOver){
    if(duck){
      walkFrame += dt*2;
    } else if(moveR){
      farmerX += 150*dt; moving = true; walkFrame += dt*10;
    } else if(moveL){
      farmerX -= 120*dt; moving = true; walkFrame += dt*10;
    }
    farmerX = Math.max(20, Math.min(MAND_X - 70, farmerX));
    /* ---- lompat ---- */
    hurtT = Math.max(0, hurtT - dt);
    jumpBuf = Math.max(0, jumpBuf - dt);
    if(jumpBuf > 0 && jumpY <= 0 && jumpV <= 0 && !duck){
      jumpV = JUMP_V; jumpBuf = 0;
      beep(420,.16,'square',.1,220);
    }
    if(jumpY > 0 || jumpV > 0){
      jumpV -= GRAV*dt;
      jumpY += jumpV*dt;
      if(jumpY <= 0){ jumpY = 0; jumpV = 0; beep(140,.06,'square',.08,-40); }
    }
    /* ---- rintangan kayu: harus dilompati ---- */
    for(let i=0;i<obstacles.length;i++){
      const o = obstacles[i], d = OBS[o.t], hw = d.w/2 - 4;
      if(jumpY < d.h && Math.abs(farmerX - o.x) < hw + 7){
        if(hurtT <= 0){
          HP -= 12; hurtT = 1; shakeT = .2;
          beep(160,.25,'sawtooth',.18,-80);
          if(navigator.vibrate) navigator.vibrate(60);
        }
        farmerX = farmerX < o.x ? o.x - hw - 7 : o.x + hw + 7;
      }
    }
    if(moving && jumpY <= 0){
      stepT -= dt;
      if(stepT <= 0){ footstep(); stepT = .28; }
    }
    if(mandState === 'danger' && !duck){
      HP -= (28 + prog*22 + (moving ? 18 : 0)) * dt;
      shakeT = .2;
      el.dmgFlash.style.opacity = .9;
      if(Math.random() < .08 && navigator.vibrate) navigator.vibrate(30);
    } else {
      el.dmgFlash.style.opacity = (mandState === 'danger') ? .25 : 0;
      if(mandState === 'safe') HP = Math.min(100, HP + 6*dt);
    }
    if(hurtT > .7) el.dmgFlash.style.opacity = .55;
    if(HP <= 0){
      HP = 0; gameOver = true; playing = false;
      stopScream();
      beep(200,.6,'sawtooth',.2,-150);
      el.overOverlay.style.display = 'flex';
      el.dmgFlash.style.opacity = 0;
      return;
    }
    /* reached the mandrake -> bury phase */
    if(farmerX >= GOAL_X){
      buryPhase = true;
      stopScream();
      mandState = 'safe';
      farmerX = GOAL_X;
      el.banner.textContent = 'MASH! BURY THE MANDRAKE!';
      el.banner.style.background = '#fb923c';
      el.banner.style.color = '#2a1000';
      el.banner.classList.remove('shaking');
      el.buryOverlay.style.display = 'flex';
      beep(440,.2,'square',.15);
    }
  }

  /* ---- HUD ---- */
  const progPct = Math.min(100, farmerX/GOAL_X*100);
  el.progFill.style.width = progPct + '%';
  el.progTxt.textContent = Math.floor(progPct) + '%';
  el.hpFill.style.width = Math.max(0, HP) + '%';
  el.hpFill.style.background = HP > 60 ? '#4ade80' : (HP > 30 ? '#facc15' : '#ef4444');
  el.hpTxt.textContent = Math.ceil(Math.max(0, HP));
  el.timeTxt.textContent = Math.floor(elapsed);
  el.coverIcon.classList.toggle('hidden', !(duck && mandState === 'danger'));

  draw(dt, duck, moving, ts/1000);
  requestAnimationFrame(loop);
}

/* ========================================================= DRAWING - GAME ========================================================= */
function draw(dt, duck, moving, time){
  const CW = cv.clientWidth, CH = cv.clientHeight;
  if(CW < 4 || CH < 4) return;
  let sc = Math.max(0.6, Math.min(2.4, CH/680));
  sc = Math.max(sc, CW/900);   /* lebar pandang dibatasi supaya kamera selalu ikut berjalan */
  const W = CW/sc, H = CH/sc;
  const camTarget = Math.max(0, Math.min(WORLD - W, farmerX - W*0.38));
  if(camSnap){ camX = camTarget; camSnap = false; }
  else camX += (camTarget - camX) * Math.min(1, dt*7);   /* halus, seperti mengikuti dari belakang */
  const cam = camX;
  ctx.save();
  ctx.scale(sc, sc);
  if(shakeT > 0 && (mandState === 'danger' || buryPhase === true)){
    shakeT -= dt;
    ctx.translate(rand(-5,5), rand(-4,4));
  }
  /* sky */
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, '#2f6b5e');
  g.addColorStop(.55, '#3d7d6a');
  g.addColorStop(.72, '#7fb069');
  g.addColorStop(.73, '#a8d05a');
  g.addColorStop(1, '#7fb844');
  ctx.fillStyle = g;
  ctx.fillRect(-12,-12,W+24,H+24);
  /* light rays */
  ctx.save();
  ctx.globalAlpha = .10;
  ctx.fillStyle = '#fff8c9';
  for(let i=0;i<3;i++){
    const x = wrap(i*260 - time*20, W+300) - 150;
    ctx.beginPath();
    ctx.moveTo(x,0); ctx.lineTo(x+90,0); ctx.lineTo(x+20,H); ctx.lineTo(x-70,H);
    ctx.fill();
  }
  ctx.restore();
  /* far trees */
  for(let i=0;i<14;i++){
    const x = wrap(i*180 - cam*.3, W+200) - 100;
    ctx.fillStyle = '#1e4a3f';
    ctx.fillRect(x, 20, 26, H*.55);
    ctx.beginPath();
    ctx.arc(x+13, 40, 46, 0, 7);
    ctx.arc(x-20, 70, 34, 0, 7);
    ctx.arc(x+45, 70, 34, 0, 7);
    ctx.fill();
  }
  /* mid trunks */
  for(let i=0;i<8;i++){
    const x = wrap(i*260 - cam*.6, W+300) - 100;
    ctx.fillStyle = '#4a3a2e';
    ctx.fillRect(x, 60, 22, H*.6);
    ctx.fillStyle = '#2f5d3a';
    ctx.beginPath(); ctx.arc(x+11, 50, 52, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f7a4a';
    ctx.beginPath(); ctx.arc(x-10, 70, 28, 0, 7); ctx.arc(x+30, 70, 28, 0, 7); ctx.fill();
  }
  /* hanging vines */
  ctx.strokeStyle = '#5fbf4a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const nvn = Math.ceil(W/170)+1;
  for(let i=0;i<nvn;i++){
    const x = wrap(i*170 - cam*.8 + time*8, W+100) - 50;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x+14, 40 + Math.sin(time*2+i)*6, x, 80);
    ctx.stroke();
    ctx.fillStyle = '#7ddf5f';
    for(let l=0;l<4;l++){
      ctx.beginPath();
      ctx.ellipse(x + (l%2 ? 8 : -8), 18 + l*16, 8, 4, l, 0, 7);
      ctx.fill();
    }
  }
  /* ground */
  const gy = H*.72;
  for(let i=0;i<20;i++){
    const x = wrap(i*130 - cam, W+260) - 130;
    ctx.fillStyle = i%2 ? '#6fbf4a' : '#8fd45a';
    ctx.beginPath();
    ctx.arc(x, gy+8, 30, Math.PI, 0);
    ctx.arc(x+28, gy+10, 24, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#b8e06a';
  ctx.fillRect(-12, gy, W+24, H-gy+12);
  ctx.fillStyle = '#8fbf4a';
  for(let i=0;i<30;i++){
    const x = wrap(i*77 - cam*1.2, W+100) - 50;
    ctx.fillRect(x, gy+14+((i*13)%(H-gy-16)), 10, 3);
  }
  /* rumah di ujung kanan */
  const homeX = MAND_X + 90 - cam;
  if(homeX > -160 && homeX < W+120) drawHouse(homeX + 50, gy, time);
  /* rintangan kayu */
  for(let i=0;i<obstacles.length;i++){
    const o = obstacles[i], sx = o.x - cam;
    if(sx > -90 && sx < W + 90) drawObstacle(sx, gy + 6, o);
  }
  /* mandrake + farmer */
  const mx = MAND_X - cam;
  const my = gy + 6;
  const fx = farmerX - cam;
  const fy = gy + 4;
  drawMandrake(mx, my, time);
  drawFarmer(fx, fy, walkFrame, duck, moving, time, jumpY, hurtT);
  /* fireflies */
  for(let i=0;i<12;i++){
    const x = (i*97 + time*30) % W;
    const y = (i*53 + Math.sin(time+i)*10 + H) % (H*.7);
    ctx.fillStyle = 'rgba(255,255,180,' + Math.max(0, .4 + .4*Math.sin(time*3+i)).toFixed(3) + ')';
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.restore();
}


function drawHouse(hx, gy, time){
  const R = (x,y,w,h,c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  /* bayangan tanah */
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(hx+4, gy+5, 80, 9, 0, 0, 7); ctx.fill();
  /* pagar kayu di sisi kanan */
  R(hx+66, gy-9, 44, 3, '#d8c9a6'); R(hx+66, gy-3, 44, 3, '#d8c9a6');
  for(let i=0;i<5;i++){
    const fx = hx+68 + i*10;
    R(fx, gy-17, 6, 19, '#f3ead2');
    ctx.fillStyle = '#f3ead2';
    ctx.beginPath(); ctx.moveTo(fx, gy-17); ctx.lineTo(fx+3, gy-22); ctx.lineTo(fx+6, gy-17); ctx.closePath(); ctx.fill();
    R(fx+4, gy-17, 2, 19, '#d8c9a6');
  }
  /* cerobong (di belakang atap) */
  R(hx+26, gy-128, 16, 46, '#9a4b3a');
  R(hx+26, gy-116, 16, 2, '#7d3a2c'); R(hx+26, gy-104, 16, 2, '#7d3a2c'); R(hx+26, gy-92, 16, 2, '#7d3a2c');
  R(hx+33, gy-122, 2, 6, '#7d3a2c'); R(hx+30, gy-110, 2, 6, '#7d3a2c'); R(hx+37, gy-98, 2, 6, '#7d3a2c');
  R(hx+24, gy-133, 20, 6, '#5a3a30');
  /* asap */
  for(let i=0;i<3;i++){
    const f = ((time*0.45) + i/3) % 1;
    ctx.globalAlpha = (1-f)*.6;
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath(); ctx.arc(hx+34 + Math.sin(time*1.4+i*2)*4 + f*12, gy-140 - f*40, 4 + f*7, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  /* dinding kayu */
  R(hx-52, gy-76, 104, 66, '#f3e2bd');
  for(let i=0;i<7;i++) R(hx-52, gy-70+i*10, 104, 2, '#e3cb98');
  R(hx+44, gy-76, 8, 66, '#dcc48f');
  /* balok kayu penyangga */
  R(hx-55, gy-78, 5, 70, '#7a4a2a'); R(hx+50, gy-78, 5, 70, '#7a4a2a');
  R(hx-55, gy-79, 110, 5, '#6a3f22');
  /* fondasi batu */
  R(hx-58, gy-12, 116, 14, '#8d918a');
  for(let i=0;i<8;i++) R(hx-58 + i*15 + (i%2)*4, gy-12, 2, 14, '#6f736d');
  R(hx-58, gy-12, 116, 2, '#adb1a9'); R(hx-58, gy-5, 116, 2, '#73776f');
  /* atap genteng merah */
  const apexY = gy-124, baseY = gy-76, halfW = 72;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.moveTo(hx-halfW, baseY+3); ctx.lineTo(hx, apexY); ctx.lineTo(hx+halfW, baseY+3); ctx.closePath(); ctx.fill();
  for(let j=0;j<6;j++){
    const y = baseY - 4 - j*8;
    const hw = halfW * (y - apexY) / (baseY - apexY);
    if(hw < 6) break;
    ctx.fillStyle = '#9c2e23';
    ctx.fillRect(Math.round(hx-hw), y, Math.round(hw*2), 2);
    ctx.fillStyle = '#dd5644';
    for(let k=-hw + (j%2)*6 + 3; k < hw-8; k += 12) ctx.fillRect(Math.round(hx+k), y+3, 6, 3);
  }
  ctx.strokeStyle = '#7a1f17'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(hx-halfW, baseY+3); ctx.lineTo(hx, apexY); ctx.lineTo(hx+halfW, baseY+3); ctx.stroke();
  R(hx-halfW-2, baseY+2, halfW*2+4, 5, '#7a1f17');
  /* jendela bulat di atap */
  ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.arc(hx, gy-97, 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#8fd6ff'; ctx.beginPath(); ctx.arc(hx, gy-97, 7.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(hx-5, gy-102, 3, 5);
  R(hx-1, gy-105, 2, 16, '#5a3a20'); R(hx-8, gy-98, 16, 2, '#5a3a20');
  /* jendela + daun jendela + kotak bunga */
  const win = wx => {
    R(wx-6, gy-64, 5, 24, '#3f7a4a'); R(wx+23, gy-64, 5, 24, '#3f7a4a');
    R(wx-6, gy-58, 5, 2, '#2f5d3a'); R(wx+23, gy-58, 5, 2, '#2f5d3a');
    R(wx-1, gy-65, 24, 26, '#5a3a20');
    R(wx+1, gy-63, 20, 22, '#8fd6ff');
    R(wx+3, gy-61, 5, 9, 'rgba(255,255,255,.55)');
    R(wx+10, gy-63, 2, 22, '#5a3a20'); R(wx+1, gy-53, 20, 2, '#5a3a20');
    R(wx-2, gy-40, 26, 6, '#7a4a1e');
    R(wx-1, gy-43, 24, 3, '#3fae2a');
    const cols = ['#ff6b8a','#ffd83a','#ff8fb0','#ffd83a','#ff6b8a'];
    for(let i=0;i<5;i++) R(wx+i*5, gy-46, 4, 4, cols[i]);
  };
  win(hx-44); win(hx+22);
  /* pintu */
  R(hx-14, gy-56, 28, 44, '#4a2a15');
  R(hx-11, gy-53, 22, 41, '#8a5230');
  R(hx-11, gy-53, 22, 4, '#a86a3c');
  R(hx-1, gy-49, 2, 37, '#6a3a1e'); R(hx-6, gy-49, 1, 37, '#74441f'); R(hx+5, gy-49, 1, 37, '#74441f');
  R(hx+6, gy-32, 3, 3, '#f4c542');
  R(hx-5, gy-47, 10, 10, '#8fd6ff'); R(hx-6, gy-48, 12, 1, '#5a3a20'); R(hx-6, gy-37, 12, 1, '#5a3a20');
  R(hx-6, gy-48, 1, 12, '#5a3a20'); R(hx+5, gy-48, 1, 12, '#5a3a20');
  /* anak tangga */
  R(hx-16, gy-12, 32, 4, '#c2c2ba'); R(hx-19, gy-8, 38, 5, '#a6a69e');
  /* semak + bunga di kiri & kanan */
  const bush = (bx, sz) => {
    ctx.fillStyle = '#2f7a3c'; ctx.beginPath(); ctx.arc(bx, gy+2, sz, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3d9a46'; ctx.beginPath(); ctx.arc(bx+sz*.55, gy+2, sz*.75, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ff8fb0'; ctx.fillRect(Math.round(bx-sz*.4), Math.round(gy-sz*.6), 3, 3);
    ctx.fillStyle = '#ffd83a'; ctx.fillRect(Math.round(bx+sz*.3), Math.round(gy-sz*.9), 3, 3);
  };
  bush(hx-62, 13); bush(hx+60, 12);
}

function drawObstacle(sx, base, o){
  const d = OBS[o.t], w = d.w, h = d.h;
  ctx.save();
  ctx.translate(sx, base);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, w*.62, 6, 0, 0, 7); ctx.fill();
  if(o.t === 'log'){
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(-w/2+3, -h, w-3, h);
    ctx.fillStyle = '#9b6330'; ctx.fillRect(-w/2+3, -h, w-3, h*.38);
    ctx.fillStyle = '#5a3210'; ctx.fillRect(-w/2+3, -h*.34, w-3, 3);
    ctx.fillStyle = '#8a5a2e';
    ctx.beginPath(); ctx.ellipse(w/2, -h/2, 6, h/2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9b27a';
    ctx.beginPath(); ctx.ellipse(-w/2+3, -h/2, 7, h/2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a5763c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-w/2+3, -h/2, 4, h/4, 0, 0, 7); ctx.stroke();
  } else {
    ctx.fillStyle = '#5a3210'; ctx.fillRect(-w/2, -8, w, 8);
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(-w/2, -8, w, 3);
    for(let i=0;i<3;i++){
      const cx = -w/2 + 10 + i*(w-20)/2;
      const th = (i === 1) ? h : h*.82;
      ctx.fillStyle = '#9b6330';
      ctx.beginPath(); ctx.moveTo(cx-8,-6); ctx.lineTo(cx,-th); ctx.lineTo(cx+8,-6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c48a4a';
      ctx.beginPath(); ctx.moveTo(cx-8,-6); ctx.lineTo(cx,-th); ctx.lineTo(cx,-6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(-w/2+3, -5, 3, 3); ctx.fillRect(w/2-6, -5, 3, 3);
  }
  ctx.restore();
}

function drawFarmer(x, y, frame, duck, moving, time, jump, hurt){
  jump = jump || 0; hurt = hurt || 0;
  ctx.save();
  ctx.translate(x, y);
  if(hurt > 0 && Math.floor(time*18) % 2 === 0) ctx.globalAlpha = .45;
  const bob = duck ? 0 : Math.abs(Math.sin(frame))*4;
  const squash = duck ? .72 : 1;
  ctx.scale(1, squash);
  /* shadow (tetap di tanah saat lompat) */
  const shr = Math.max(.45, 1 - jump/160);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(0, 2, 20*shr, 6*shr, 0, 0, 7); ctx.fill();
  ctx.translate(0, -jump);
  const legSwing = jump > 3 ? 9 : ((moving && !duck) ? Math.sin(frame)*8 : 0);
  /* legs */
  ctx.fillStyle = '#6b5a3e';
  ctx.fillRect(-10+legSwing*.5, -28-bob, 9, 28);
  ctx.fillRect(1-legSwing*.5, -28-bob, 9, 28);
  ctx.fillStyle = '#3d2c1a';
  ctx.fillRect(-12+legSwing*.5, -6, 13, 6);
  ctx.fillRect(-1-legSwing*.5, -6, 13, 6);
  /* body */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-13, -52-bob, 26, 26);
  ctx.fillStyle = '#8a7a54';
  ctx.fillRect(-10, -50-bob, 20, 24);
  ctx.fillStyle = '#5a4a30';
  ctx.fillRect(-10, -50-bob, 20, 4);
  ctx.fillStyle = '#4a3d28';
  ctx.fillRect(-3, -50-bob, 6, 14);
  if(!duck){
    /* basket */
    ctx.fillStyle = '#b07a3a';
    ctx.fillRect(-26, -46-bob, 14, 14);
    ctx.fillStyle = '#7a4a1a';
    for(let i=0;i<3;i++) ctx.fillRect(-26, -46-bob+i*5, 14, 2);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-24, -50-bob, 6, 5);
    ctx.fillStyle = '#ffdf3a';
    ctx.fillRect(-17, -51-bob, 6, 6);
    ctx.fillStyle = '#5fbf3a';
    ctx.fillRect(-22, -54-bob, 8, 4);
    /* arms */
    ctx.fillStyle = '#ffca9a';
    ctx.fillRect(-18, -48-bob + (moving ? Math.sin(frame)*4 : 0), 6, 14);
    ctx.fillRect( 12, -48-bob - (moving ? Math.sin(frame)*4 : 0), 6, 14);
  } else {
    /* hands over ears */
    ctx.fillStyle = '#ffca9a';
    ctx.fillRect(-17, -67, 7, 12);
    ctx.fillRect( 10, -67, 7, 12);
    ctx.fillStyle = '#e8b083';
    ctx.fillRect(-17, -67, 7, 3);
    ctx.fillRect( 10, -67, 7, 3);
  }
  /* head */
  ctx.fillStyle = '#ffca9a';
  ctx.fillRect(-10, -70-bob, 20, 18);
  ctx.fillStyle = '#000';
  const blink = duck ? 2 : (Math.sin(time*3) > .97 ? 2 : 5);
  ctx.fillRect(-6, -64-bob, 4, blink+1);
  ctx.fillRect( 2, -64-bob, 4, blink+1);
  ctx.fillStyle = '#7a3a2a';
  ctx.fillRect(-3, -58-bob, 6, 2);
  if(mandState === 'danger'){
    ctx.fillStyle = 'rgba(255,80,80,.6)';
    ctx.fillRect(-10, -60-bob, 5, 4);
    ctx.fillRect( 5, -60-bob, 5, 4);
  }
  /* hat */
  ctx.fillStyle = '#a67c52';
  ctx.fillRect(-15, -76-bob, 30, 7);
  ctx.fillStyle = '#8a623d';
  ctx.fillRect(-9, -88-bob, 18, 13);
  ctx.fillStyle = '#5f442c';
  ctx.fillRect(-9, -79-bob, 18, 3);
  ctx.restore();
}

function drawMandrake(x, y, time){
  const danger = (mandState === 'danger');
  const warn = (mandState === 'warn');
  const burying = (buryPhase === true || buryPhase === 'done');
  const bp = burying ? (buryPhase === 'done' ? 1 : buryProg/100) : 0;
  const sink = bp * 175;
  const moundH = 5 + bp*28;

  ctx.save();
  ctx.translate(x, y);

  /* ground shadow */
  if(!burying){
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(0, 2, 46, 10, 0, 0, 7); ctx.fill();
  }

  /* body (clipped above ground while sinking) */
  ctx.save();
  if(burying){
    ctx.beginPath();
    ctx.rect(-110, -250, 220, 250);
    ctx.clip();
    ctx.translate(0, sink);
  }

  const breathe = Math.sin(time*(danger ? 10 : 2)) * (danger ? 5 : 2);
  const facingAway = (mandState === 'safe');
  const wiggle = Math.sin(time*(danger ? 12 : 3))*6;

  /* root legs */
  ctx.strokeStyle = '#5a1f0f';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for(let i=-1;i<=1;i++){
    ctx.beginPath();
    ctx.moveTo(i*16, -46);
    ctx.quadraticCurveTo(i*20 + wiggle, -20, i*24, -2);
    ctx.stroke();
  }
  /* arms */
  ctx.lineWidth = 8;
  if(burying){
    ctx.beginPath(); ctx.moveTo(-26,-80); ctx.lineTo(-50, -36 + Math.sin(time*2)*4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 26,-80); ctx.lineTo( 50, -36 - Math.sin(time*2)*4); ctx.stroke();
  } else if(facingAway){
    ctx.beginPath(); ctx.moveTo(-24,-78); ctx.lineTo(-44, -60 + wiggle*.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 24,-78); ctx.lineTo( 44, -60 - wiggle*.5); ctx.stroke();
  } else {
    const up = danger ? -112 : -96;
    ctx.beginPath(); ctx.moveTo(-26,-80); ctx.lineTo(-54, up + breathe); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 26,-80); ctx.lineTo( 54, up - breathe); ctx.stroke();
    ctx.fillStyle = '#3a0f0a';
    for(let k=0;k<3;k++){
      ctx.fillRect(-60+k*6, up+breathe-8+k*2, 5, 10);
      ctx.fillRect( 48+k*6, up-breathe-8+k*2, 5, 10);
    }
  }
  /* body */
  ctx.fillStyle = burying ? '#b06a34' : '#c47a3a';
  ctx.beginPath();
  ctx.moveTo(-30,-120); ctx.lineTo(30,-120); ctx.lineTo(34,-60);
  ctx.lineTo(20,-40); ctx.lineTo(-20,-40); ctx.lineTo(-34,-60);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b2d1a';
  ctx.fillRect(-30, -98, 60, 8);
  ctx.fillRect(-32, -76, 64, 8);
  /* leaves */
  const leafSway = Math.sin(time*3)*6;
  ctx.fillStyle = burying ? '#3d9a2c' : '#4ecb3a';
  ctx.beginPath(); ctx.ellipse(-16, -132, 22, 12, -.4 + leafSway*.01, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 16, -134, 22, 12, .4 - leafSway*.01, 0, 7); ctx.fill();
  ctx.fillStyle = '#2f8a1f';
  ctx.fillRect(-3, -136, 6, 16);
  ctx.fillStyle = '#a8ff7a';
  ctx.fillRect(-24, -136, 10, 3);
  ctx.fillRect( 10, -138, 10, 3);
  /* face */
  if(burying){
    ctx.fillStyle = '#1a0a04';
    ctx.fillRect(-18, -104, 10, 3);
    ctx.fillRect(  8, -104, 10, 3);
    ctx.fillRect( -5, -88, 10, 3);
  } else if(facingAway){
    ctx.fillStyle = '#000';
    ctx.fillRect(-28, -110, 8, 10);
    ctx.fillRect(-28, -92, 12, 3);
    const zf = (time*1.4) % 1;
    ctx.globalAlpha = 1 - zf;
    ctx.fillStyle = '#eafff0';
    const zx = 22 + zf*8, zy = -118 - zf*14, zs = 4;
    ctx.fillRect(Math.round(zx), Math.round(zy), zs*3, zs);
    ctx.fillRect(Math.round(zx+zs*2), Math.round(zy+zs), zs, zs);
    ctx.fillRect(Math.round(zx+zs), Math.round(zy+zs*2), zs, zs);
    ctx.fillRect(Math.round(zx), Math.round(zy+zs*3), zs*3, zs);
    ctx.globalAlpha = 1;
  } else if(warn){
    ctx.fillStyle = '#000';
    ctx.fillRect(-18, -110, 10, 12);
    ctx.fillRect(  8, -110, 10, 12);
    ctx.fillStyle = '#ffdf00';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('!', -5, -122 + Math.sin(time*12)*3);
  } else if(danger){
    ctx.fillStyle = '#fff';
    ctx.fillRect(-22, -114, 14, 14);
    ctx.fillRect(  8, -114, 14, 14);
    ctx.fillStyle = '#000';
    ctx.fillRect(-18, -110, 8, 8);
    ctx.fillRect( 12, -110, 8, 8);
    ctx.fillStyle = '#1a0000';
    ctx.beginPath(); ctx.ellipse(0, -84, 16, 18+breathe, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.ellipse(0, -76, 9, 7, 0, 0, 7); ctx.fill();
    /* SOUND WAVE ANIMATION */
    for(let i=0;i<3;i++){
      const r = 30 + ((time*90 + i*28) % 84);
      ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 1 - r/120).toFixed(3) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, -84, r, -.6, .6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -84, r, Math.PI-.6, Math.PI+.6); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,255,120,' + Math.max(0, .8 - r/140).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -84, r+8, -.6, .6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -84, r+8, Math.PI-.6, Math.PI+.6); ctx.stroke();
    }
  }
  ctx.restore(); /* end clip */

  /* dirt mound grows as you bury */
  if(bp > 0){
    const mw = 34 + bp*30;
    ctx.fillStyle = '#4a2f16';
    ctx.beginPath(); ctx.ellipse(0, 2, mw, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath(); ctx.ellipse(0, -1, mw, moundH, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#7a522a';
    for(let i=0;i<8;i++){
      ctx.fillRect(-mw+10 + i*((mw*2-20)/7), -moundH + (i%2)*5, 8, 6);
    }
    if(bp > .5){
      ctx.fillStyle = '#3fae2a';
      ctx.fillRect(-13, -moundH-9, 10, 8);
      ctx.fillRect(  3, -moundH-11, 10, 8);
      ctx.fillStyle = '#57cf39';
      ctx.fillRect(-9, -moundH-13, 8, 5);
      ctx.fillRect(  5, -moundH-14, 8, 5);
      ctx.fillStyle = '#2f8a1f';
      ctx.fillRect(-2, -moundH-8, 4, 8);
    }
  }
  /* sleeping Zzz */
  if(burying){
    const zf = (time*0.9) % 1;
    ctx.globalAlpha = 1 - zf;
    ctx.fillStyle = '#fff';
    const zs = 6;
    const zx = 26 + zf*16;
    const zy = -(moundH + 26) - zf*22;
    ctx.fillRect(Math.round(zx), Math.round(zy), zs*3, zs);
    ctx.fillRect(Math.round(zx+zs*2), Math.round(zy+zs), zs, zs);
    ctx.fillRect(Math.round(zx+zs), Math.round(zy+zs*2), zs, zs);
    ctx.fillRect(Math.round(zx), Math.round(zy+zs*3), zs*3, zs);
    ctx.globalAlpha = 1;
  }
  /* mood bar */
  if(!buryPhase){
    const w = 80;
    ctx.fillStyle = '#000';
    ctx.fillRect(-w/2, -160, w, 12);
    ctx.fillStyle = danger ? '#ef4444' : (warn ? '#facc15' : '#4ade80');
    ctx.fillRect(-w/2+2, -158, w-4, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(danger ? '!!' : (warn ? '?!' : 'zz'), 0, -166);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/* ========================================================= WIN SCENE - PIXEL FOREST ========================================================= */
const winCv = $('winCanvas');
let winRAF = null;
function drawWinScene(){
  const r = winCv.getBoundingClientRect();
  if(r.width < 20 || r.height < 20) return;
  const s = 3;
  const W = Math.max(60, Math.round(r.width/s));
  const H = Math.max(40, Math.round(r.height/s));
  if(winCv.width !== W || winCv.height !== H){ winCv.width = W; winCv.height = H; }
  const x = winCv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const t = Date.now()/1000;
  const R = (px,py,pw,ph,col) => { x.fillStyle = col; x.fillRect(Math.round(px), Math.round(py), Math.max(1,Math.round(pw)), Math.max(1,Math.round(ph))); };
  const gy = Math.round(H*0.80);
  /* sky */
  const g = x.createLinearGradient(0,0,0,H);
  g.addColorStop(0, 'rgba(18,60,48,0)');
  g.addColorStop(.55, 'rgba(20,64,50,.75)');
  g.addColorStop(1, '#0a2318');
  x.fillStyle = g;
  x.fillRect(0,0,W,H);
  /* tree silhouettes */
  for(let i=0;i<Math.ceil(W/16)+1;i++){
    const h0 = H*(0.30 + hash01(i*2.3)*0.52);
    const px = i*16 + hash01(i*5.1)*8 - 6;
    R(px-1.5, gy-h0*0.6, 3, h0*0.6, '#0a2318');
    R(px-h0*0.24, gy-h0, h0*0.48, h0*0.44, '#103a29');
    R(px-h0*0.15, gy-h0*1.12, h0*0.30, h0*0.18, '#103a29');
    R(px-h0*0.40, gy-h0*0.88, h0*0.22, h0*0.16, '#0e3324');
    R(px+h0*0.18, gy-h0*0.88, h0*0.22, h0*0.16, '#0e3324');
  }
  /* ground */
  R(0, gy, W, H-gy, '#0a2318');
  for(let i=0;i<W;i+=3){
    const hh = 1 + hash01(i*7.7)*3;
    R(i, gy-hh, 1, hh, i%2 ? '#256b3c' : '#1c5530');
  }
  /* sleeping mandrake mound */
  const mx = Math.round(W*0.5);
  R(mx-16, gy-9, 32, 9, '#5a3a1e');
  R(mx-12, gy-14, 24, 6, '#7a522a');
  R(mx-16, gy-6, 32, 3, '#4a2f16');
  R(mx-19, gy-4, 5, 4, '#6b4a26');
  R(mx+15, gy-5, 5, 5, '#6b4a26');
  R(mx-8, gy-19, 7, 6, '#3fae2a');
  R(mx+2, gy-21, 7, 6, '#57cf39');
  R(mx-1, gy-17, 3, 6, '#2f8a1f');
  /* Zzz */
  const zf = (t*0.7) % 1;
  x.globalAlpha = Math.max(0, 1 - zf);
  const zs = 3, zx = mx + 12 + zf*10, zy = gy - 26 - zf*16;
  x.fillStyle = '#eafff0';
  x.fillRect(Math.round(zx), Math.round(zy), zs*3, zs);
  x.fillRect(Math.round(zx+zs*2), Math.round(zy+zs), zs, zs);
  x.fillRect(Math.round(zx+zs), Math.round(zy+zs*2), zs, zs);
  x.fillRect(Math.round(zx), Math.round(zy+zs*3), zs*3, zs);
  x.globalAlpha = 1;
  /* fireflies */
  for(let i=0;i<26;i++){
    const fx2 = wrap(hash01(i*3.7)*W + Math.sin(t*0.5+i)*6, W);
    const fy2 = wrap(hash01(i*9.1)*gy + Math.cos(t*0.7+i)*4, gy);
    x.globalAlpha = 0.25 + 0.55*Math.abs(Math.sin(t*1.5 + i));
    x.fillStyle = '#d9ff8a';
    x.fillRect(Math.round(fx2), Math.round(fy2), 2, 2);
    x.globalAlpha = 1;
  }
  /* pixel confetti */
  for(let i=0;i<16;i++){
    x.fillStyle = ['#ffd83a','#ff6b6b','#8ac154','#7ddfff'][i%4];
    const cx2 = wrap(hash01(i*3.3)*W + t*(8+hash01(i)*14), W);
    const cy2 = wrap(hash01(i*7.7)*H + t*(10+hash01(i*2)*16), H);
    x.fillRect(Math.round(cx2), Math.round(cy2), 2, 2);
  }
}
function winLoop(){
  if(!pages.win.classList.contains('active')){ winRAF = null; return; }
  drawWinScene();
  winRAF = requestAnimationFrame(winLoop);
}

/* ========================================================= CONFETTI - HALAMAN SURAT ========================================================= */
const cfCv = document.createElement('canvas');
cfCv.id = 'confettiCanvas';
pages.letter.insertBefore(cfCv, pages.letter.firstChild);
const cfx = cfCv.getContext('2d');
let cfRAF = null, cfParts = [], cfLast = 0, cfSpawn = 0, cfT = 0;
const CF_COLORS = ['#ffd83a','#ff6b6b','#8ac154','#7ddfff','#ff8fb0','#ffffff','#b48cff'];

function sizeConfetti(){
  const r = cfCv.getBoundingClientRect();
  cfCv.width = Math.max(1, Math.round(r.width));
  cfCv.height = Math.max(1, Math.round(r.height));
}
function cfSize(){
  const uu = parseFloat(document.documentElement.style.getPropertyValue('--u')) || 1;
  const b = Math.max(4, Math.round(4*uu));
  return Math.random() < .3 ? b*2 : b;
}
function cfPush(x,y,vx,vy){
  if(cfParts.length > 320) return;
  cfParts.push({ x:x, y:y, vx:vx, vy:vy, s:cfSize(), c:CF_COLORS[(Math.random()*CF_COLORS.length)|0],
                 ph:rand(0,6.283), sw:rand(1.5,4), fl:rand(4,10) });
}
/* ledakan confetti dari dua sudut bawah */
function cfBurst(){
  if(!pages.letter.classList.contains('active')) return;
  const W = cfCv.width, H = cfCv.height;
  if(W < 20 || H < 20) return;
  const n = Math.round(Math.min(70, Math.max(34, W/20)));
  for(let i=0;i<n;i++){
    const left = (i % 2 === 0);
    const th = rand(0.18, 0.85);
    const sp = rand(0.75, 1.35) * H;
    cfPush(left ? -6 : W+6, H+6, Math.sin(th)*sp*(left ? 1 : -1), -Math.cos(th)*sp);
  }
  [784,988,1175].forEach((f,i) => setTimeout(() => beep(f,.09,'square',.08), i*70));
}
function cfUpdate(dt){
  const W = cfCv.width, H = cfCv.height;
  const g = H*1.25, term = H*0.32;
  /* hujan confetti pelan dari atas */
  cfSpawn += dt * Math.max(8, W/40);
  while(cfSpawn >= 1){ cfSpawn -= 1; cfPush(rand(0,W), -10, rand(-20,20), rand(0.10,0.22)*H); }
  for(let i=cfParts.length-1;i>=0;i--){
    const p = cfParts[i];
    p.vy += g*dt;
    if(p.vy > term) p.vy += (term - p.vy) * Math.min(1, dt*3);
    p.vx *= Math.pow(0.45, dt);
    p.x += (p.vx + Math.sin(cfT*p.sw + p.ph)*24) * dt;
    p.y += p.vy*dt;
    if(p.y > H + 20 || p.x < -60 || p.x > W + 60) cfParts.splice(i,1);
  }
}
function cfDraw(){
  cfx.clearRect(0,0,cfCv.width,cfCv.height);
  for(let i=0;i<cfParts.length;i++){
    const p = cfParts[i];
    const w = Math.max(1, Math.round(p.s * (0.25 + 0.75*Math.abs(Math.cos(cfT*p.fl + p.ph)))));
    cfx.fillStyle = p.c;
    cfx.fillRect(Math.round(p.x), Math.round(p.y), w, p.s);
  }
}
function cfLoop(ts){
  if(!pages.letter.classList.contains('active')){ cfRAF = null; cfParts = []; return; }
  let dt = (ts - cfLast)/1000;
  if(!(dt > 0)) dt = 0;
  if(dt > .05) dt = .05;
  cfLast = ts; cfT += dt;
  cfUpdate(dt); cfDraw();
  cfRAF = requestAnimationFrame(cfLoop);
}
function startConfetti(){
  sizeConfetti();
  cfParts = []; cfSpawn = 0;
  cfBurst();
  setTimeout(cfBurst, 500);
  cfLast = performance.now();
  if(!cfRAF) cfRAF = requestAnimationFrame(cfLoop);
}
/* ketuk di mana saja pada halaman surat = confetti lagi */
pages.letter.addEventListener('pointerdown', e => { if(!e.target.closest('button')) cfBurst(); });

/* ========================================================= MODAL / NAV ========================================================= */
$('btnHow').onclick = () => {
  ac(); beep(600,.1);
  const m = $('howModal');
  m.classList.remove('hidden');
  m.classList.add('flex');
};
$('btnCloseHow').onclick = () => {
  beep(500,.1);
  const m = $('howModal');
  m.classList.add('hidden');
  m.classList.remove('flex');
};
$('btnHome').onclick = () => { beep(500,.12); show('cover'); };
$('btnNext').onclick = () => { beep(700,.12); show('letter'); };
$('btnReplay').onclick = () => {
  beep(600,.12);
  show('game');
  resetGame();
  el.introOverlay.style.display = 'none';
  playing = true;
  lastTs = performance.now();
  requestAnimationFrame(loop);
};

/* ========================================================= BOOT ========================================================= */
drawPixelStars($('letterStars'), 5, 5, 3);
drawMiniMandrake(1, 0);
setBanner();
startCoverLoop();