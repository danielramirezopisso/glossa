// ΓΛΩΣΣΑ — griego desde el español · 100% offline
"use strict";

// ————— state —————
const S = {
  tab: "curso", view: null,
  data: {},
  dic: JSON.parse(localStorage.getItem("glossa-dic") || "[]"),
  hl: JSON.parse(localStorage.getItem("glossa-hl") || "{}"),
  mistextos: JSON.parse(localStorage.getItem("glossa-mistextos") || "[]"),
  quiz: null, hlMode: false,
  index: null, // reverse lookup, built after data load
};

const $ = (id) => document.getElementById(id);
const app = $("app");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (w) => w.toLowerCase();

function saveDic() { localStorage.setItem("glossa-dic", JSON.stringify(S.dic)); updateDicCount(); }
function saveHl() { localStorage.setItem("glossa-hl", JSON.stringify(S.hl)); }
function saveMis() { localStorage.setItem("glossa-mistextos", JSON.stringify(S.mistextos)); }
function updateDicCount() { $("dicCount").textContent = S.dic.length ? `Λεξικό·${S.dic.length}` : "Λεξικό"; }

// ————— data loading + reverse index —————
async function loadData() {
  const files = ["verbos", "vocab", "lecciones", "frases", "textos", "lexico"];
  await Promise.all(files.map(async (f) => {
    const r = await fetch(`data/${f}.json`);
    S.data[f] = await r.json();
  }));
  buildIndex();
}

function buildIndex() {
  const ix = new Map();
  const add = (form, entry) => {
    const k = norm(form);
    if (!k) return;
    if (!ix.has(k)) ix.set(k, []);
    ix.get(k).push(entry);
  };
  const P = S.data.verbos.personas;
  // every conjugated form of every verb → rich explanation
  S.data.verbos.verbos.forEach((v, vi) => {
    v.lemma.split(" / ").forEach((l) => add(l, { type: "verbo-lemma", vi }));
    [["pres", "presente"], ["imp", "imperfecto"], ["aor", "aoristo"]].forEach(([tk, tn]) => {
      v[tk].forEach((form, pi) => {
        if (form !== "—") add(form, { type: "verbo-forma", vi, tiempo: tn, persona: P[pi] });
      });
    });
    v.imper.forEach((form, i) => { if (form !== "—") add(form, { type: "verbo-forma", vi, tiempo: "imperativo", persona: i === 0 ? "εσύ" : "εσείς" }); });
    add(v.fut.replace(/^θα\s+/, ""), { type: "verbo-forma", vi, tiempo: "futuro (tras θα)", persona: P[0] });
  });
  // vocab themes
  S.data.vocab.temas.forEach((t) => {
    t.words.forEach(([el, es]) => {
      el.split(" / ").forEach((variant) => {
        add(variant, { type: "vocab", el, es, tema: t.label });
        const noArt = variant.replace(/^(ο|η|το|οι|τα|τις|τους)\s+/, "");
        if (noArt !== variant) add(noArt, { type: "vocab", el, es, tema: t.label });
      });
    });
  });
  // lexicon of function words
  S.data.lexico.lexico.forEach(([el, es, pos, nota]) => {
    el.split(" / ").forEach((variant) => {
      add(variant.replace(/^(ο|η|το|οι|τα)\s+/, ""), { type: "lexico", el, es, pos, nota });
      add(variant, { type: "lexico", el, es, pos, nota });
    });
  });
  S.index = ix;
}

// ————— morphology analyzer (heuristic hints for unknown words) —————
const MORFO = [
  [/όμαστε$|όμαστε$/,"verbo deponente · εμείς · presente/imperfecto"],
  [/όμουν$/,"verbo deponente · εγώ · imperfecto (p.ej. ερχόμουν = venía)"],
  [/όταν$/,"verbo deponente · αυτός/ή · imperfecto"],
  [/ομαι$/,"verbo deponente/pasivo · εγώ · presente (p.ej. έρχομαι)"],
  [/εσαι$/,"verbo deponente · εσύ · presente"],
  [/εται$/,"verbo deponente · αυτός/ή · presente (p.ej. φαίνεται = parece)"],
  [/ονται$/,"verbo deponente · αυτοί · presente"],
  [/ήκαμε$|ηκαμε$/,"verbo · εμείς · aoristo pasivo/deponente (-θηκα)"],
  [/ηκε$|ήκε$/,"verbo · αυτός/ή · aoristo pasivo/deponente"],
  [/θηκα$/,"verbo · εγώ · aoristo pasivo/deponente (κοιμήθηκα = dormí)"],
  [/ουμε$|ούμε$/,"verbo · εμείς (nosotros) · presente"],
  [/ετε$|είτε$|άτε$/,"verbo · εσείς (vosotros/usted) · presente o imperativo"],
  [/ουν$|ούν$|άνε$|ουνε$/,"verbo · αυτοί (ellos) · presente"],
  [/εις$|είς$|άς$/,"verbo · εσύ (tú) · presente"],
  [/άει$|εί$/,"verbo · αυτός/ή · presente"],
  [/αμε$|άμε$/,"verbo · εμείς · pasado (aoristo/imperfecto) o presente en -άμε"],
  [/ατε$|άτε$/,"verbo · εσείς · pasado o imperativo plural"],
  [/ησα$|ισα$|ασα$|εσα$/,"verbo · εγώ · aoristo (pasado simple)"],
  [/ησε$|ισε$|ωσε$/,"verbo · αυτός/ή · aoristo"],
  [/ούσα$/,"verbo en -άω/-ώ · εγώ · imperfecto (μιλούσα = hablaba)"],
  [/ούσε$/,"verbo en -άω/-ώ · αυτός/ή · imperfecto"],
  [/ούσαμε$/,"verbo en -άω/-ώ · εμείς · imperfecto"],
  [/αω$|άω$|ώ$/,"verbo · εγώ · presente (grupo B: αγαπάω, μπορώ)"],
  [/ω$/,"verbo · εγώ (yo) · presente (γράφω)"],
  [/ες$/,"verbo εσύ pasado (-ες) o sustantivo femenino plural (οι μέρες)"],
  [/αν$|ανε$/,"verbo · αυτοί · pasado"],
  [/ματα$/,"sustantivo neutro plural en -μα (τα μαθήματα)"],
  [/ματος$/,"sustantivo neutro -μα · genitivo singular (του μαθήματος)"],
  [/μα$/,"sustantivo neutro en -μα (το πρόβλημα) — ¡suelen venir del griego al español!"],
  [/ος$/,"sustantivo/adjetivo masculino · nominativo (ο δρόμος) — a veces neutro (το μέρος)"],
  [/ου$/,"genitivo singular masc./neutro: 'de...' (του δρόμου)"],
  [/ων$/,"genitivo plural: 'de los/las...' (των παιδιών)"],
  [/ούς$|ους$/,"masculino acusativo plural (τους δρόμους)"],
  [/οι$/,"masculino nominativo plural (οι φίλοι)"],
  [/ια$|ιά$/,"neutro plural (τα παιδιά) o femenino en -ιά"],
  [/ι$|ί$/,"sustantivo neutro (το παιδί, το κρασί)"],
  [/η$|ή$/,"femenino singular (η αγάπη) o neutro plural arcaico"],
  [/α$|ά$/,"femenino singular (η μέρα), neutro plural (τα βιβλία) o verbo 1ª pers. pasado (-α)"],
  [/ο$|ό$/,"neutro singular (το βιβλίο) o adverbio"],
];
function morfoHints(word) {
  const hints = [];
  for (const [re, hint] of MORFO) {
    if (re.test(word)) { hints.push(hint); if (hints.length >= 3) break; }
  }
  return hints;
}

// ————— navigation —————
function go(tab, view = null) {
  S.tab = tab; S.view = view; S.quiz = null; S.hlMode = false;
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  render();
  window.scrollTo(0, 0);
}

function render() {
  if (!S.index) { app.innerHTML = `<div class="spinner"></div><div class="spinlbl">Cargando ΓΛΩΣΣΑ…</div>`; return; }
  ({ curso: renderCurso, ejercicios: renderEjercicios, vocab: renderVocab, textos: renderTextos, dic: renderDic, ajustes: renderAjustes }[S.tab])();
  bindGreekWords();
}

function bindGreekWords() {
  app.querySelectorAll(".gw").forEach((el) => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      if (S.hlMode && el.dataset.hk) { // highlighter mode in texts
        const k = el.dataset.hk;
        if (S.hl[k]) delete S.hl[k]; else S.hl[k] = 1;
        saveHl();
        el.classList.toggle("marked", !!S.hl[k]);
        return;
      }
      wordSheet(el.dataset.w, el.dataset.el || "", el.dataset.es || "");
    };
  });
}
function greekSpan(word, ctxEl, ctxEs, hlKey) {
  const clean = word.replace(/[.,;·!;»«"'()\[\]…:]/g, "");
  if (!clean || !/[Α-Ωα-ωάέήίόύώϊϋΐΰΆΈΉΊΌΎΏ]/.test(clean)) return esc(word);
  const marked = hlKey && S.hl[hlKey] ? " marked" : "";
  return `<span class="gw${marked}" data-w="${esc(clean)}" data-el="${esc(ctxEl)}" data-es="${esc(ctxEs)}"${hlKey ? ` data-hk="${esc(hlKey)}"` : ""}>${esc(word)}</span>`;
}
function greekText(sentence, ctxEs, keyPrefix) {
  return sentence.split(/\s+/).map((w, wi) => greekSpan(w, sentence, ctxEs, keyPrefix ? `${keyPrefix}:${wi}` : null)).join(" ");
}

// ═════════ CURSO ═════════
function renderCurso() {
  if (S.view && S.view.lesson != null) return renderLesson(S.view.lesson);
  if (S.view && S.view.verb != null) return renderVerb(S.view.verb);
  const L = S.data.lecciones.lecciones, V = S.data.verbos.verbos;
  app.innerHTML = `
    <h1>El curso</h1>
    <p class="sub">Gramática del griego moderno explicada desde el español. Toca cualquier palabra griega en cualquier pantalla para investigarla — todo funciona sin conexión.</p>
    <div class="stitle">Lecciones · ${L.length}</div>
    ${L.map((l, i) => `
      <div class="card tap row" onclick="go('curso',{lesson:${i}})">
        <div><div class="t">${esc(l.title)}</div><div class="s">${esc(l.sub)}</div></div>
        <span class="lvl">${l.lvl}</span>
      </div>`).join("")}
    <div class="stitle">Verbos con conjugación completa · ${V.length}</div>
    <div class="chips">
      ${V.map((v, i) => `<button class="chip" onclick="go('curso',{verb:${i}})"><span class="serif">${esc(v.lemma)}</span> · ${esc(v.es)}</button>`).join("")}
    </div>`;
}

function renderLesson(i) {
  const l = S.data.lecciones.lecciones[i];
  app.innerHTML = `
    <button class="back" onclick="go('curso')">← Lecciones</button>
    <h2>${esc(l.title)}</h2>
    <div class="s serif" style="font-size:15px;margin-bottom:14px">${esc(l.sub)} · ${l.lvl}</div>
    ${l.blocks.map((b) => {
      if (b.t === "p") return `<p class="lx">${esc(b.x)}</p>`;
      if (b.t === "tbl") return `<div class="tblwrap"><table>${b.h.some(x=>x) ? `<tr>${b.h.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>` : ""}${b.r.map((row) => `<tr>${row.map((c) => `<td class="${/[Α-Ωα-ω]/.test(c) ? "gr" : ""}">${/[Α-Ωα-ω]/.test(c) ? c.split(/\s+/).map((w) => greekSpan(w, c, "")).join(" ") : esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
      return `<div class="ex"><div class="el">${greekText(b.el, b.es)}</div><div class="es">${esc(b.es)}</div></div>`;
    }).join("")}
    <div class="notice">¿Dudas con esta lección? Pregúntale a Claude (incluido en tu suscripción) y guarda lo que aprendas como nota en tu λεξικό.</div>`;
}

function renderVerb(i) {
  const v = S.data.verbos.verbos[i], P = S.data.verbos.personas;
  const saved = S.dic.some((d) => d.lemma === v.lemma);
  app.innerHTML = `
    <button class="back" onclick="go('curso')">← Verbos</button>
    <h2 class="serif">${esc(v.lemma)}</h2>
    <p class="sub">${esc(v.es)} · tipo ${esc(v.tipo)} · futuro: <b class="serif">${esc(v.fut)}</b> · imperativo: <b class="serif">${esc(v.imper[0])} / ${esc(v.imper[1])}</b></p>
    ${v.nota ? `<div class="notice">${esc(v.nota)}</div>` : ""}
    <div class="tblwrap"><table>
      <tr><th></th><th>Presente</th><th>Imperfecto</th><th>Aoristo</th></tr>
      ${P.map((p, j) => `<tr><td>${esc(p)}</td><td class="gr">${esc(v.pres[j])}</td><td class="gr">${esc(v.imp[j])}</td><td class="gr">${esc(v.aor[j])}</td></tr>`).join("")}
    </table></div>
    <p class="lx" style="color:var(--ink-soft);font-size:14px">${esc(S.data.verbos.nota_futuro)}</p>
    <button class="btn" onclick="quickSave('${esc(v.lemma)}','${esc(v.es)}','verbo');render()" ${saved ? "disabled" : ""}>${saved ? "En tu λεξικό ✓" : "Guardar en mi λεξικό"}</button>`;
}

// ═════════ EJERCICIOS ═════════
function renderEjercicios() {
  if (S.quiz) return renderQuiz();
  app.innerHTML = `
    <h1>Práctica</h1>
    <p class="sub">Ejercicios infinitos generados desde el contenido. Todo offline, todo gratis, para siempre.</p>
    <div class="card tap" onclick="startQuiz('conj')"><div class="t">Conjugación de verbos</div><div class="s">¿Cómo se dice «nosotros, aoristo, γράφω»?</div></div>
    <div class="card tap" onclick="startQuiz('voc-el')"><div class="t">Vocabulario: griego → español</div><div class="s">Reconoce la palabra griega</div></div>
    <div class="card tap" onclick="startQuiz('voc-es')"><div class="t">Vocabulario: español → griego</div><div class="s">Encuentra la palabra griega</div></div>
    <div class="card tap" onclick="startQuiz('frase')"><div class="t">Construye la frase</div><div class="s">Ordena las palabras de una frase real</div></div>
    <div class="card tap" onclick="startQuiz('dic')"><div class="t">Repaso de mi λεξικό</div><div class="s">${S.dic.length < 4 ? "Guarda al menos 4 palabras para practicar" : `Tarjetas con tus ${S.dic.length} palabras (repetición espaciada)`}</div></div>`;
}

function startQuiz(mode) {
  if (mode === "dic" && S.dic.length < 4) return;
  S.tab = "ejercicios";
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.tab === "ejercicios"));
  S.quiz = { mode, score: 0, total: 0, streak: 0 };
  nextQuestion();
}

function nextQuestion() {
  const q = S.quiz;
  if (q.mode === "conj") {
    const v = pick(S.data.verbos.verbos);
    const [tk, tn] = pick([["pres", "presente"], ["imp", "imperfecto"], ["aor", "aoristo"]]);
    const pi = Math.floor(Math.random() * 6);
    const correct = v[tk][pi];
    const pool = new Set([correct]);
    let guard = 0;
    while (pool.size < 4 && guard++ < 60) pool.add(pick([...v.pres, ...v.imp, ...v.aor]));
    q.card = { q: v.lemma, meta: `${S.data.verbos.personas[pi]} · ${tn} · (${v.es})`, correct, opts: shuffle([...pool]) };
  } else if (q.mode === "voc-el" || q.mode === "voc-es") {
    const t = pick(S.data.vocab.temas);
    const w = pick(t.words);
    const el2es = q.mode === "voc-el";
    const correct = el2es ? w[1] : w[0];
    const pool = new Set([correct]);
    let guard = 0;
    while (pool.size < 4 && guard++ < 60) { const o = pick(t.words); pool.add(el2es ? o[1] : o[0]); }
    q.card = { q: el2es ? w[0] : w[1], meta: t.label, correct, opts: shuffle([...pool]), qSerif: el2es };
  } else if (q.mode === "frase") {
    const s = pick(S.data.frases.situaciones);
    const cands = s.phrases.filter((p) => { const n = p[0].split(/\s+/).length; return n >= 3 && n <= 8; });
    const [el, es] = pick(cands.length ? cands : s.phrases);
    const words = el.split(/\s+/);
    q.card = { es: es.split("(")[0].trim(), words, order: shuffle(words.map((_, i) => i)), built: [], done: false };
  } else if (q.mode === "dic") {
    const now = Date.now();
    const due = S.dic.filter((d) => !d.due || d.due <= now);
    q.card = { w: pick(due.length ? due : S.dic), revealed: false };
  }
  renderQuiz();
}

function renderQuiz() {
  const q = S.quiz, c = q.card;
  const head = `<button class="back" onclick="S.quiz=null;render()">← Práctica</button>
    <div class="score"><span>✓ ${q.score}/${q.total}</span><span>racha ${q.streak}</span></div>`;
  if (q.mode === "frase") {
    app.innerHTML = `${head}
      <div class="quiz"><div class="qm">Construye en griego:</div><div style="font-size:17px;margin-bottom:14px">«${esc(c.es)}»</div>
      <div class="built serif">${c.built.map((i) => esc(c.words[i])).join(" ") || "&nbsp;"}</div>
      <div class="wordbank">${c.order.map((i) => `<button class="wtoken ${c.built.includes(i) ? "used" : ""}" onclick="tapToken(${i})">${esc(c.words[i])}</button>`).join("")}</div>
      ${c.done ? `<div style="color:var(--ok);font-weight:700;margin:8px 0">Σωστά! ¡Correcto!</div><button class="btn" onclick="nextQuestion()">Siguiente →</button>` : `<button class="btn ghost" onclick="S.quiz.card.built=[];renderQuiz()">Borrar</button>`}
      </div>`;
    return;
  }
  if (q.mode === "dic") {
    const w = c.w;
    app.innerHTML = `${head}
      <div class="flash" onclick="S.quiz.card.revealed=!S.quiz.card.revealed;renderQuiz()">
        <div class="wbig">${esc(w.lemma)}</div>
        <div style="margin-top:12px;font-size:17px;color:${c.revealed ? "var(--ink)" : "var(--muted)"}">${c.revealed ? esc(w.es) : "toca para revelar"}</div>
        ${c.revealed && w.nota ? `<div style="margin-top:8px;font-size:14px;color:var(--ink-soft);font-style:italic">${esc(w.nota)}</div>` : ""}
      </div>
      ${c.revealed ? `<div class="btnrow" style="justify-content:center">
        <button class="btn ghost" onclick="gradeCard(false)">Difícil ✗</button>
        <button class="btn" onclick="gradeCard(true)">La sabía ✓</button>
      </div>` : ""}`;
    return;
  }
  app.innerHTML = `${head}
    <div class="quiz">
      <div class="q ${c.qSerif === false ? "" : "serif"}">${esc(c.q)}</div>
      <div class="qm">${esc(c.meta)}</div>
      <div class="opts">${c.opts.map((o) => `<button class="opt" data-o="${esc(o)}" onclick="answer(this)">${esc(o)}</button>`).join("")}</div>
    </div>`;
}

function answer(btn) {
  const q = S.quiz, c = q.card;
  const chosen = btn.dataset.o;
  q.total++;
  document.querySelectorAll(".opt").forEach((b) => {
    b.onclick = null;
    if (b.dataset.o === c.correct) b.classList.add("right");
    else if (b === btn) b.classList.add("wrong");
  });
  if (chosen === c.correct) { q.score++; q.streak++; } else q.streak = 0;
  setTimeout(nextQuestion, chosen === c.correct ? 700 : 1600);
}

function tapToken(i) {
  const c = S.quiz.card;
  if (c.built.includes(i) || c.done) return;
  c.built.push(i);
  if (c.built.length === c.words.length) {
    const ok = c.built.every((idx, pos) => c.words[idx] === c.words[pos]);
    if (ok) { c.done = true; S.quiz.score++; S.quiz.total++; S.quiz.streak++; }
    else { S.quiz.total++; S.quiz.streak = 0; c.built = []; }
  }
  renderQuiz();
}

function gradeCard(ok) {
  const w = S.quiz.card.w;
  const entry = S.dic.find((d) => d.lemma === w.lemma);
  if (entry) {
    entry.box = Math.max(0, Math.min(4, (entry.box || 0) + (ok ? 1 : -1)));
    entry.due = Date.now() + [0, 1, 3, 7, 21][entry.box] * 864e5;
    saveDic();
  }
  if (ok) { S.quiz.score++; S.quiz.streak++; } else S.quiz.streak = 0;
  S.quiz.total++;
  nextQuestion();
}

// ═════════ VOCAB ═════════
function renderVocab() {
  const mode = (S.view && S.view.mode) || "temas";
  const themes = S.data.vocab.temas, sits = S.data.frases.situaciones;
  const ti = (S.view && S.view.t) || 0, si = (S.view && S.view.s) || 0;
  app.innerHTML = `
    <h1>Vocabulario</h1>
    <div class="chips">
      <button class="chip ${mode === "temas" ? "on" : ""}" onclick="go('vocab',{mode:'temas'})">Por temas</button>
      <button class="chip ${mode === "frases" ? "on" : ""}" onclick="go('vocab',{mode:'frases'})">Frases por situación</button>
    </div>
    ${mode === "temas" ? `
      <div class="chips">${themes.map((t, i) => `<button class="chip ${i === ti ? "on" : ""}" onclick="go('vocab',{mode:'temas',t:${i}})">${esc(t.label)}</button>`).join("")}</div>
      ${themes[ti].words.map(([el, es]) => {
        const saved = S.dic.some((d) => d.lemma === el);
        return `<div class="card row">
          <div style="flex:1;cursor:pointer" onclick="wordSheet('${esc(el).replace(/'/g, "\\'")}','','${esc(es).replace(/'/g, "\\'")}')">
            <span class="serif" style="font-size:17px">${esc(el)}</span>
            <div style="color:var(--muted);font-size:13px">${esc(es)}</div>
          </div>
          <button class="plus ${saved ? "saved" : ""}" onclick="quickSave('${esc(el).replace(/'/g, "\\'")}','${esc(es).replace(/'/g, "\\'")}','');render()">${saved ? "✓" : "+"}</button>
        </div>`;
      }).join("")}
      <p class="hint">Toca la palabra para su ficha · + para guardarla</p>` : `
      <div class="chips">${sits.map((s, i) => `<button class="chip ${i === si ? "on" : ""}" onclick="go('vocab',{mode:'frases',s:${i}})">${esc(s.label)}</button>`).join("")}</div>
      ${sits[si].phrases.map(([el, es]) => `
        <div class="card">
          <div class="serif" style="font-size:17px">${greekText(el, es)}</div>
          <div style="color:var(--muted);font-size:13px;margin-top:2px">${esc(es)}</div>
        </div>`).join("")}
      <p class="hint">Toca cualquier palabra para investigarla</p>`}`;
}

// ═════════ TEXTOS ═════════
function renderTextos() {
  if (S.view && S.view.texto != null) return renderTexto(S.view.texto, false);
  if (S.view && S.view.mio != null) return renderTexto(S.view.mio, true);
  if (S.view === "nuevo") return renderNuevoTexto();
  const T = S.data.textos.textos;
  app.innerHTML = `
    <h1>Textos paralelos</h1>
    <p class="sub">Lecturas en griego y español, frase a frase. Toca palabras griegas para investigarlas, frases españolas para ver su pareja, y activa el rotulador ✏ para subrayar.</p>
    ${["A1", "A2", "B1"].map((lv) => `
      <div class="stitle">Nivel ${lv}</div>
      ${T.map((t, i) => t.lvl === lv ? `
        <div class="card tap row" onclick="go('textos',{texto:${i}})">
          <div><div class="t serif">${esc(t.titulo_el)}</div><div class="s" style="font-family:inherit">${esc(t.titulo_es)}</div></div>
          <span class="lvl">${t.frases.length} frases</span>
        </div>` : "").join("")}`).join("")}
    <div class="stitle">Mis textos · ${S.mistextos.length}</div>
    ${S.mistextos.map((t, i) => `
      <div class="card tap row" onclick="go('textos',{mio:${i}})">
        <div><div class="t serif">${esc(t.titulo_el)}</div><div class="s" style="font-family:inherit">${esc(t.titulo_es)}</div></div>
        <span class="lvl">${t.frases.length} frases</span>
      </div>`).join("")}
    <button class="btn ghost" style="margin-top:6px" onclick="go('textos','nuevo')">+ Añadir un texto</button>
    <div class="notice" style="margin-top:14px"><b>Biblioteca infinita gratis:</b> pídele a Claude un texto en griego sobre cualquier tema con su traducción al español (entra en tu suscripción), pega los dos aquí, y la app los alinea frase a frase. Prueba: «Escríbeme un texto A2 en griego moderno sobre [tema], frase a frase, con traducción al español».</div>`;
}

function splitSentences(txt) {
  return txt.replace(/\s+/g, " ").trim().split(/(?<=[.;!?…])\s+/).filter((x) => x.trim());
}

function renderNuevoTexto() {
  app.innerHTML = `
    <button class="back" onclick="go('textos')">← Textos</button>
    <h2>Añadir un texto</h2>
    <p class="sub">Pega el texto griego y su traducción. La app los divide por frases (punto, ; ! ? …) y los empareja en orden.</p>
    <input type="text" id="ntEl" placeholder="Título en griego (opcional)" style="margin-bottom:8px">
    <input type="text" id="ntEs" placeholder="Título en español (opcional)" style="margin-bottom:8px">
    <textarea id="ntGr" rows="5" placeholder="Texto en griego…" style="margin-bottom:8px"></textarea>
    <textarea id="ntSp" rows="5" placeholder="Traducción en español…" style="margin-bottom:8px"></textarea>
    <div id="ntErr"></div>
    <button class="btn big" onclick="saveNuevoTexto()">Guardar en mi biblioteca</button>`;
}

function saveNuevoTexto() {
  const gr = splitSentences($("ntGr").value), sp = splitSentences($("ntSp").value);
  if (!gr.length || !sp.length) { $("ntErr").innerHTML = `<div class="err">Faltan los dos textos.</div>`; return; }
  const n = Math.min(gr.length, sp.length);
  const frases = [];
  for (let i = 0; i < n; i++) {
    const el = i === n - 1 ? gr.slice(i).join(" ") : gr[i];
    const es = i === n - 1 ? sp.slice(i).join(" ") : sp[i];
    frases.push([el, es]);
  }
  const warn = gr.length !== sp.length ? ` (aviso: ${gr.length} frases griegas vs ${sp.length} españolas — he unido las sobrantes al final; edita los puntos si no cuadra)` : "";
  S.mistextos.unshift({
    id: "m" + Date.now(),
    titulo_el: $("ntEl").value.trim() || gr[0].slice(0, 40) + "…",
    titulo_es: $("ntEs").value.trim() || "Mi texto",
    frases,
  });
  saveMis();
  alert("Texto guardado" + warn);
  go("textos");
}

function renderTexto(i, mio) {
  const t = mio ? S.mistextos[i] : S.data.textos.textos[i];
  const tid = mio ? t.id : "t" + i;
  app.innerHTML = `
    <button class="back" onclick="go('textos')">← Textos</button>
    <div class="row" style="align-items:flex-start">
      <div><h2 class="serif">${esc(t.titulo_el)}</h2>
      <div style="color:var(--muted);font-size:15px;margin-bottom:12px">${esc(t.titulo_es)}${t.lvl ? " · " + t.lvl : ""}</div></div>
      <button class="chip ${S.hlMode ? "on" : ""}" id="hlBtn" onclick="S.hlMode=!S.hlMode;$('hlBtn').classList.toggle('on',S.hlMode);$('hlHint').textContent=S.hlMode?'Rotulador activo: toca palabras para subrayarlas / quitarlas':'Toca una palabra griega para investigarla · una frase española para ver su pareja';">✏ Subrayar</button>
    </div>
    ${t.frases.map(([el, es], si) => "").join("")}
    <p class="gtext">${t.frases.map(([el, es], si) => `<span class="pr pr-el" data-i="${si}">${greekText(el, es, tid + ":" + si)}</span>`).join(" ")}</p>
    <p class="estext">${t.frases.map(([el, es], si) => `<span class="sp pr pr-es" data-i="${si}">${esc(es)}</span>`).join(" ")}</p>
    <p class="hint" id="hlHint">Toca una palabra griega para investigarla · una frase española para ver su pareja</p>
    ${mio ? `<button class="btn ghost" style="margin-top:10px" onclick="if(confirm('¿Borrar este texto?')){S.mistextos.splice(${i},1);saveMis();go('textos')}">Borrar texto</button>` : ""}`;
  app.querySelectorAll(".pr-es").forEach((elx) => {
    elx.onclick = () => {
      const si = +elx.dataset.i;
      app.querySelectorAll(".pr").forEach((x) => x.classList.toggle("pair-on", +x.dataset.i === si));
    };
  });
}

// ═════════ ΛΕΞΙΚΟ ═════════
function renderDic() {
  const marked = Object.keys(S.hl).length;
  app.innerHTML = `
    <h1>Το λεξικό μου</h1>
    <p class="sub">Tu diccionario personal: ${S.dic.length} ${S.dic.length === 1 ? "palabra" : "palabras"}${marked ? ` · ${marked} palabras subrayadas en textos` : ""}. Cada palabra acepta tus propias notas.</p>
    ${S.dic.length >= 4 ? `<button class="btn" style="margin-bottom:16px" onclick="startQuiz('dic')">Practicar con tarjetas</button>` : ""}
    ${S.dic.length === 0 ? `<p class="hint" style="text-align:left">Aún está vacío. Toca palabras griegas en cualquier sección y pulsa «Guardar».</p>` :
      S.dic.map((v, i) => `
        <div class="card">
          <div class="row">
            <div style="flex:1;cursor:pointer" onclick="wordSheet('${esc(v.lemma).replace(/'/g, "\\'")}','','${esc(v.es).replace(/'/g, "\\'")}')">
              <span class="serif" style="font-size:17px">${esc(v.lemma)}</span>
              ${v.pos ? `<span style="color:var(--muted);font-size:12px;margin-left:8px">${esc(v.pos)}</span>` : ""}
              <div style="color:var(--ink-soft);font-size:13px">${esc(v.es)}</div>
              ${v.nota ? `<div style="color:var(--honey-deep);font-size:13px;font-style:italic;margin-top:2px">✎ ${esc(v.nota)}</div>` : ""}
            </div>
            <button class="plus" onclick="event.stopPropagation();S.dic.splice(${i},1);saveDic();render()">×</button>
          </div>
        </div>`).join("")}`;
}

function quickSave(lemma, es, pos) {
  if (S.dic.some((d) => d.lemma === lemma)) return;
  S.dic.unshift({ lemma, es, pos, nota: "", date: Date.now(), box: 0, due: 0 });
  saveDic();
}

// ═════════ AJUSTES ═════════
function renderAjustes() {
  app.innerHTML = `
    <h1>Ajustes</h1>
    <div class="notice">ΓΛΩΣΣΑ funciona 100% offline y gratis: no usa ninguna API ni envía datos a ningún sitio. Todo vive en tu dispositivo.</div>
    <div class="stitle">Copia de seguridad</div>
    <p class="sub">Exporta tu λεξικό, notas, subrayados y textos propios para moverlos a otro dispositivo.</p>
    <div class="btnrow">
      <button class="btn" onclick="exportAll()">Exportar todo</button>
      <button class="btn ghost" onclick="$('impBox').style.display='block'">Importar</button>
    </div>
    <div id="impBox" style="display:none;margin-top:10px">
      <textarea id="impData" rows="4" placeholder="Pega aquí el JSON exportado…"></textarea>
      <button class="btn" style="margin-top:8px" onclick="importAll()">Cargar copia</button>
    </div>
    <div class="stitle">Cómo ampliar Glossa gratis</div>
    <p class="sub">Pídele contenido a Claude (entra en tu suscripción) y tráelo aquí:</p>
    <p class="sub">· <b>Textos nuevos:</b> «Escríbeme un texto nivel A2 en griego moderno sobre [tema] con traducción al español» → pégalo en Textos → + Añadir un texto.</p>
    <p class="sub">· <b>Dudas de palabras:</b> pregunta a Claude y guarda la respuesta como nota en la ficha de la palabra.</p>
    <p class="sub">· <b>Más contenido del curso</b> (verbos, lecciones, temas): pídeselo a Claude en la conversación de Glossa y lo añadirá al repositorio.</p>
    <div class="stitle">Zona de peligro</div>
    <button class="btn ghost" onclick="if(confirm('¿Borrar TODO (λεξικό, notas, subrayados, mis textos)?')){localStorage.clear();location.reload()}">Borrar todos mis datos</button>`;
}

function exportAll() {
  const blob = JSON.stringify({ dic: S.dic, hl: S.hl, mistextos: S.mistextos, v: 1 });
  navigator.clipboard.writeText(blob).then(
    () => alert("Copia exportada al portapapeles. Guárdala donde quieras."),
    () => prompt("Copia este JSON:", blob)
  );
}
function importAll() {
  try {
    const d = JSON.parse($("impData").value);
    if (d.dic) S.dic = d.dic;
    if (d.hl) S.hl = d.hl;
    if (d.mistextos) S.mistextos = d.mistextos;
    saveDic(); saveHl(); saveMis();
    alert("Copia cargada ✓"); go("dic");
  } catch (e) { alert("JSON no válido"); }
}

// ═════════ FICHA DE PALABRA (motor offline) ═════════
function openSheet(title, bodyHTML) {
  $("sheetTitle").textContent = title;
  $("sheetBody").innerHTML = bodyHTML;
  $("sheetOverlay").classList.add("open");
  $("sheetBody").querySelectorAll(".gw").forEach((el) => {
    el.onclick = (ev) => { ev.stopPropagation(); wordSheet(el.dataset.w, "", ""); };
  });
}
function closeSheet(ev) { if (!ev || ev.target === $("sheetOverlay")) $("sheetOverlay").classList.remove("open"); }

function wordSheet(word, ctxEl, ctxEs) {
  const hits = S.index.get(norm(word)) || [];
  const P = S.data.verbos.personas;
  let html = `<div class="wbig">${esc(word)}</div>`;
  let saveLemma = word, saveEs = ctxEs || "", savePos = "";
  const seen = new Set();
  const parts = [];

  for (const h of hits) {
    if (h.type === "verbo-forma" || h.type === "verbo-lemma") {
      const v = S.data.verbos.verbos[h.vi];
      const k = "v" + h.vi + (h.tiempo || "");
      if (seen.has(k)) continue; seen.add(k);
      saveLemma = v.lemma; saveEs = v.es; savePos = "verbo";
      parts.push(`
        <div class="wrow"><div class="wk">Verbo</div>
        <div class="wv"><b class="serif">${esc(v.lemma)}</b> = ${esc(v.es)}${h.type === "verbo-forma" ? `<br>Esta forma es <b>${esc(h.tiempo)}</b>, persona <b class="serif">${esc(h.persona)}</b>.` : ""}</div></div>
        <div class="tblwrap"><table><tr><th></th><th>Pres.</th><th>Imperf.</th><th>Aor.</th></tr>
        ${P.map((p, j) => `<tr><td>${esc(p)}</td><td class="gr">${esc(v.pres[j])}</td><td class="gr">${esc(v.imp[j])}</td><td class="gr">${esc(v.aor[j])}</td></tr>`).join("")}</table></div>
        ${v.nota ? `<div class="wrow"><div class="wk">Nota</div><div class="wv">${esc(v.nota)}</div></div>` : ""}`);
    } else if (h.type === "vocab") {
      const k = "w" + h.el; if (seen.has(k)) continue; seen.add(k);
      if (savePos !== "verbo") { saveLemma = h.el; saveEs = h.es; }
      parts.push(`<div class="wrow"><div class="wk">Vocabulario · ${esc(h.tema)}</div><div class="wv"><b class="serif">${esc(h.el)}</b> = ${esc(h.es)}</div></div>`);
    } else if (h.type === "lexico") {
      const k = "l" + h.el; if (seen.has(k)) continue; seen.add(k);
      if (savePos !== "verbo") { saveLemma = h.el; saveEs = h.es; savePos = h.pos; }
      parts.push(`<div class="wrow"><div class="wk">${esc(h.pos)}</div><div class="wv"><b class="serif">${esc(h.el)}</b> = ${esc(h.es)}${h.nota ? `<br><span style="color:var(--ink-soft)">${esc(h.nota)}</span>` : ""}</div></div>`);
    }
  }

  if (!parts.length) {
    const hints = morfoHints(word);
    parts.push(`<div class="wrow"><div class="wk">No está en el diccionario offline (todavía)</div><div class="wv">${ctxEs ? `En esta frase, el español dice: «${esc(ctxEs)}».` : ""}</div></div>`);
    if (hints.length) parts.push(`<div class="wrow"><div class="wk">Pistas por la terminación</div><div class="wv">${hints.map((h) => "· " + esc(h)).join("<br>")}</div></div>`);
    parts.push(`<div class="wrow"><div class="wv" style="color:var(--ink-soft)">Investiga: pregúntale a Claude «¿qué significa ${esc(word)} y por qué tiene esta forma?» y guarda aquí lo que aprendas como nota.</div></div>`);
  }

  if (ctxEl && parts.length) {
    parts.unshift(`<div class="wrow"><div class="wk">En la frase</div><div class="wv serif" style="font-size:16px">${esc(ctxEl)}</div>${ctxEs ? `<div class="wv" style="color:var(--muted);font-size:13px">${esc(ctxEs)}</div>` : ""}</div>`);
  }

  const entry = S.dic.find((d) => d.lemma === saveLemma || d.lemma === word);
  html += `<div class="wpos">${esc(savePos)}</div>` + parts.join("");
  html += `
    <div class="stitle" style="margin-top:14px">Mi nota</div>
    <textarea id="notaBox" rows="2" placeholder="Apunta aquí lo que descubras sobre esta palabra…">${esc(entry ? entry.nota || "" : "")}</textarea>
    <div class="btnrow">
      <button class="btn" id="saveWordBtn">${entry ? "Actualizar nota ✎" : "Guardar palabra"}</button>
    </div>`;
  openSheet("Ficha de palabra", html);
  $("saveWordBtn").onclick = () => {
    const nota = $("notaBox").value.trim();
    let e = S.dic.find((d) => d.lemma === saveLemma || d.lemma === word);
    if (!e) { e = { lemma: saveLemma, es: saveEs || "—", pos: savePos, nota: "", date: Date.now(), box: 0, due: 0 }; S.dic.unshift(e); }
    e.nota = nota;
    saveDic();
    $("saveWordBtn").textContent = "Guardado ✓";
    if (S.tab === "dic" || S.tab === "vocab") render();
  };
}

// ————— boot —————
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
updateDicCount();
render();
loadData().then(render).catch(() => {
  app.innerHTML = `<div class="err">No se pudieron cargar los datos. Comprueba tu conexión y recarga (la primera vez necesita internet; después funciona offline).</div>`;
});
