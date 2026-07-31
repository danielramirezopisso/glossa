// LENGUA — real Spanish for English speakers · 100% offline
"use strict";

const S = {
  tab: "curso", view: null,
  data: {},
  dic: JSON.parse(localStorage.getItem("lengua-dic") || "[]"),
  hl: JSON.parse(localStorage.getItem("lengua-hl") || "{}"),
  mistextos: JSON.parse(localStorage.getItem("lengua-mistextos") || "[]"),
  quiz: null, hlMode: false, index: null,
};

const $ = (id) => document.getElementById(id);
const app = $("app");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const norm = (w) => w.toLowerCase();
const TENSE_KEYS = ["pres","pret","imp","fut","cond","subj","subimp"];

function saveDic() { localStorage.setItem("lengua-dic", JSON.stringify(S.dic)); updateDicCount(); }
function saveHl() { localStorage.setItem("lengua-hl", JSON.stringify(S.hl)); }
function saveMis() { localStorage.setItem("lengua-mistextos", JSON.stringify(S.mistextos)); }
function updateDicCount() { $("dicCount").textContent = S.dic.length ? `Words·${S.dic.length}` : "My words"; }

// ————— data + reverse index —————
async function loadData() {
  const files = ["verbos", "vocab", "lecciones", "frases", "textos", "lexico", "drills"];
  await Promise.all(files.map(async (f) => {
    const r = await fetch(`data/${f}.json`);
    S.data[f] = await r.json();
  }));
  buildIndex();
}

function stripRefl(form) { return form.replace(/^(me|te|se|nos|os)\s+/, ""); }

function buildIndex() {
  const ix = new Map();
  const add = (form, entry) => {
    const k = norm(form);
    if (!k || k === "—") return;
    if (!ix.has(k)) ix.set(k, []);
    ix.get(k).push(entry);
  };
  const T = S.data.verbos.tiempos;
  S.data.verbos.verbos.forEach((v, vi) => {
    add(v.lemma, { type: "verbo-lemma", vi });
    add(stripRefl(v.lemma.replace(/se$/, "")), { type: "verbo-lemma", vi });
    TENSE_KEYS.forEach((tk) => {
      v[tk].forEach((form, pi) => {
        add(form, { type: "verbo-forma", vi, tk, tiempo: T[tk], persona: S.data.verbos.personas[pi] });
        const bare = stripRefl(form);
        if (bare !== form) add(bare, { type: "verbo-forma", vi, tk, tiempo: T[tk], persona: S.data.verbos.personas[pi] });
      });
    });
    v.imper.forEach((form, i) => add(form, { type: "verbo-forma", vi, tk: "imper", tiempo: "Imperative", persona: i === 0 ? "tú" : "vosotros" }));
    add(v.ger, { type: "verbo-forma", vi, tk: "ger", tiempo: "Gerund (-ing)", persona: "—" });
    add(v.part, { type: "verbo-forma", vi, tk: "part", tiempo: "Participle (with haber: he " + v.part + ")", persona: "—" });
  });
  S.data.vocab.temas.forEach((t) => {
    t.words.forEach(([es, en]) => {
      es.split(" / ").forEach((variant) => {
        add(variant, { type: "vocab", es, en, tema: t.label });
        const noArt = variant.replace(/^(el|la|los|las|un|una)\s+/, "");
        if (noArt !== variant) add(noArt, { type: "vocab", es, en, tema: t.label });
      });
    });
  });
  S.data.lexico.lexico.forEach(([es, en, pos, nota]) => {
    es.split(" / ").forEach((variant) => {
      add(variant, { type: "lexico", es, en, pos, nota });
      const noArt = variant.replace(/^(el|la|los|las)\s+/, "");
      if (noArt !== variant) add(noArt, { type: "lexico", es, en, pos, nota });
    });
  });
  S.index = ix;
}

// ————— morphology hints for unknown Spanish words —————
const MORFO = [
  [/ábamos$|íamos$/,"verb · nosotros · imperfect (we were -ing / used to)"],
  [/aban$|ían$/,"verb · ellos · imperfect"],
  [/abas$|ías$/,"verb · tú · imperfect"],
  [/aba$|ía$/,"verb · yo or él/ella · imperfect (was -ing / used to) — or conditional if stem ends in r"],
  [/áramos$|iéramos$/,"verb · nosotros · past subjunctive (if we...)"],
  [/aran$|ieran$/,"verb · ellos · past subjunctive"],
  [/ara$|iera$/,"verb · past subjunctive (si tuviera... = if I had...)"],
  [/aría.*|ería.*|iría.*/,"conditional (would): -ría endings on the infinitive"],
  [/aremos$|eremos$|iremos$/,"verb · nosotros · future (will)"],
  [/arán$|erán$|irán$/,"verb · ellos · future"],
  [/arás$|erás$|irás$/,"verb · tú · future"],
  [/aré$|eré$|iré$/,"verb · yo · future (will)"],
  [/ará$|erá$|irá$/,"verb · él/ella · future — or a guess: «será» = it must be"],
  [/asteis$|isteis$/,"verb · vosotros · preterite (you all did)"],
  [/amos$/,"verb · nosotros · present or preterite (-ar)"],
  [/aron$|ieron$/,"verb · ellos · preterite (they did)"],
  [/aste$|iste$/,"verb · tú · preterite (you did)"],
  [/emos$|imos$/,"verb · nosotros · present"],
  [/áis$|éis$|ís$/,"verb · vosotros (Spain's y'all) · present"],
  [/ando$|iendo$|yendo$/,"gerund (-ing form): estar + this = progressive"],
  [/ado$|ido$/,"participle (-ed): with haber = have done; alone = adjective"],
  [/mente$/,"adverb (-ly): rápidamente = quickly"],
  [/ción$|sión$/,"feminine noun (la -ción) — usually = English -tion"],
  [/dad$|tad$/,"feminine noun (la -dad) — usually = English -ty"],
  [/ísimo$|ísima$/,"superlative: buenísimo = really good"],
  [/ito$|ita$|illo$|illa$/,"diminutive: cafecito = little coffee (affection)"],
  [/an$|en$/,"verb · ellos · present — or subjunctive if after a trigger"],
  [/as$|es$/,"verb · tú · present — or plural noun/adjective"],
  [/o$/,"verb · yo · present — or masculine noun/adjective"],
  [/a$|e$/,"verb · él/ella · present — or noun/adjective — or subjunctive after que"],
  [/os$|s$/,"plural noun or adjective"],
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
  if (!S.index) { app.innerHTML = `<div class="spinner"></div><div class="spinlbl">Loading LENGUA…</div>`; return; }
  ({ curso: renderCurso, ejercicios: renderEjercicios, vocab: renderVocab, textos: renderTextos, dic: renderDic, ajustes: renderAjustes }[S.tab])();
  bindWords();
}

function bindWords() {
  app.querySelectorAll(".gw").forEach((el) => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      if (S.hlMode && el.dataset.hk) {
        const k = el.dataset.hk;
        if (S.hl[k]) delete S.hl[k]; else S.hl[k] = 1;
        saveHl();
        el.classList.toggle("marked", !!S.hl[k]);
        return;
      }
      wordSheet(el.dataset.w, el.dataset.es || "", el.dataset.en || "");
    };
  });
}
function spanWord(word, ctxEs, ctxEn, hlKey) {
  const clean = word.replace(/[.,;!?¿¡«»"'()\[\]…:—]/g, "");
  if (!clean || !/[a-záéíóúñüA-ZÁÉÍÓÚÑ]/.test(clean)) return esc(word);
  const marked = hlKey && S.hl[hlKey] ? " marked" : "";
  return `<span class="gw${marked}" data-w="${esc(clean)}" data-es="${esc(ctxEs)}" data-en="${esc(ctxEn)}"${hlKey ? ` data-hk="${esc(hlKey)}"` : ""}>${esc(word)}</span>`;
}
function spanish(sentence, ctxEn, keyPrefix) {
  return sentence.split(/\s+/).map((w, wi) => spanWord(w, sentence, ctxEn, keyPrefix ? `${keyPrefix}:${wi}` : null)).join(" ");
}

// ═════════ COURSE ═════════
function renderCurso() {
  if (S.view && S.view.lesson != null) return renderLesson(S.view.lesson);
  if (S.view && S.view.verb != null) return renderVerb(S.view.verb);
  const L = S.data.lecciones.lecciones, V = S.data.verbos.verbos;
  app.innerHTML = `
    <h1>The course</h1>
    <p class="sub">Spanish grammar built for English speakers who already speak but never studied. Tap any Spanish word anywhere to investigate it — everything works offline.</p>
    <div class="stitle">Lessons · ${L.length}</div>
    ${L.map((l, i) => `
      <div class="card tap row" onclick="go('curso',{lesson:${i}})">
        <div><div class="t">${esc(l.title)}</div><div class="s">${esc(l.sub)}</div></div>
        <span class="lvl">${l.lvl}</span>
      </div>`).join("")}
    <div class="stitle">Verbs, fully conjugated · ${V.length}</div>
    <input type="text" id="vFilter" placeholder="Search a verb… (Spanish or English, e.g. dormir / to sleep)" oninput="filterVerbs()" style="margin-bottom:10px">
    <div class="chips" id="verbChips">
      ${V.map((v, i) => `<button class="chip vchip" data-t="${esc(norm(v.lemma + " " + v.en + " " + v.pret[0]))}" onclick="go('curso',{verb:${i}})"><span class="serif">${esc(v.lemma)}</span> · ${esc(v.en)}</button>`).join("")}
    </div>`;
}

function filterVerbs() {
  const q = norm($("vFilter").value.trim());
  document.querySelectorAll(".vchip").forEach((c) => {
    c.style.display = !q || c.dataset.t.includes(q) ? "" : "none";
  });
}

function renderLesson(i) {
  const l = S.data.lecciones.lecciones[i];
  app.innerHTML = `
    <button class="back" onclick="go('curso')">← Lessons</button>
    <h2>${esc(l.title)}</h2>
    <div class="s serif" style="font-size:15px;margin-bottom:14px">${esc(l.sub)} · ${l.lvl}</div>
    ${l.blocks.map((b) => {
      if (b.t === "p") return `<p class="lx">${esc(b.x)}</p>`;
      if (b.t === "tbl") return `<div class="tblwrap"><table>${b.h.some(x=>x) ? `<tr>${b.h.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>` : ""}${b.r.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
      return `<div class="ex"><div class="el">${spanish(b.es, b.en)}</div><div class="es">${esc(b.en)}</div></div>`;
    }).join("")}
    <div class="notice">Questions about this lesson? Ask Claude, then save what you learn as a note on any word.</div>`;
}

const USO_SHORT = { pres:"now / habits", pret:"did (completed)", imp:"was doing / used to", fut:"will / must be", cond:"would / politeness", subj:"after que-triggers", subimp:"if I… / past triggers" };

function renderVerb(i) {
  const v = S.data.verbos.verbos[i], P = S.data.verbos.personas, T = S.data.verbos.tiempos;
  const saved = S.dic.some((d) => d.lemma === v.lemma);
  const pair = (tk) => `
    <div class="stitle" style="margin-top:14px">${T[tk]} <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--honey-deep)">· ${USO_SHORT[tk]}</span></div>
    <div class="tblwrap"><table>${P.map((p, j) => `<tr><td style="width:38%">${esc(p)}</td><td class="gr">${esc(v[tk][j])}</td></tr>`).join("")}</table></div>`;
  app.innerHTML = `
    <button class="back" onclick="go('curso')">← Verbs</button>
    <h2 class="serif">${esc(v.lemma)}</h2>
    <p class="sub">${esc(v.en)} · type ${esc(v.tipo)} · gerund: <b class="serif">${esc(v.ger)}</b> · participle: <b class="serif">${esc(v.part)}</b> · imperative: <b class="serif">${esc(v.imper[0])} / ${esc(v.imper[1])}</b></p>
    ${v.nota ? `<div class="notice">${esc(v.nota)}</div>` : ""}
    <div class="tblwrap"><table>
      <tr><th></th><th>Present</th><th>Preterite</th><th>Imperfect</th></tr>
      ${P.map((p, j) => `<tr><td>${esc(p)}</td><td class="gr">${esc(v.pres[j])}</td><td class="gr">${esc(v.pret[j])}</td><td class="gr">${esc(v.imp[j])}</td></tr>`).join("")}
    </table></div>
    <div class="tblwrap"><table>
      <tr><th></th><th>Future</th><th>Conditional</th><th>Subjunctive</th><th>Past subj.</th></tr>
      ${P.map((p, j) => `<tr><td>${esc(p)}</td><td class="gr">${esc(v.fut[j])}</td><td class="gr">${esc(v.cond[j])}</td><td class="gr">${esc(v.subj[j])}</td><td class="gr">${esc(v.subimp[j])}</td></tr>`).join("")}
    </table></div>
    <div class="stitle">When do I use each tense?</div>
    ${TENSE_KEYS.map((tk) => `<p class="lx" style="font-size:14px"><b>${T[tk]}:</b> ${esc(S.data.verbos.uso[tk])}</p>`).join("")}
    <button class="btn" onclick="quickSave('${esc(v.lemma)}','${esc(v.en)}','verb');render()" ${saved ? "disabled" : ""}>${saved ? "In My words ✓" : "Save to My words"}</button>`;
}

// ═════════ PRACTICE ═════════
function renderEjercicios() {
  if (S.quiz) return renderQuiz();
  const D = S.data.drills.drills;
  app.innerHTML = `
    <h1>Practice</h1>
    <p class="sub">Infinite exercises generated from the course. All offline, all free, forever.</p>
    <div class="stitle">The Big Battles</div>
    ${Object.keys(D).map((k) => `<div class="card tap" onclick="startQuiz('drill:${k}')"><div class="t">${esc(D[k].title)}</div><div class="s">${esc(D[k].sub)}</div></div>`).join("")}
    <div class="stitle">Core skills</div>
    <div class="card tap" onclick="startQuiz('conj')"><div class="t">Verb conjugation</div><div class="s">Which form is «nosotros, preterite, hacer»?</div></div>
    <div class="card tap" onclick="startQuiz('tense-id')"><div class="t">Name that tense</div><div class="s">See a form like «hiciera» — say which tense it is</div></div>
    <div class="card tap" onclick="startQuiz('voc-es')"><div class="t">Vocabulary: Spanish → English</div><div class="s">Recognize the Spanish word</div></div>
    <div class="card tap" onclick="startQuiz('voc-en')"><div class="t">Vocabulary: English → Spanish</div><div class="s">Find the Spanish word</div></div>
    <div class="card tap" onclick="startQuiz('frase')"><div class="t">Build the sentence</div><div class="s">Put a real sentence back in order</div></div>
    <div class="card tap" onclick="startQuiz('dic')"><div class="t">Review My words</div><div class="s">${S.dic.length < 4 ? "Save at least 4 words to practice" : `Flashcards with your ${S.dic.length} words (spaced repetition)`}</div></div>`;
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
  if (q.mode.startsWith("drill:")) {
    const set = S.data.drills.drills[q.mode.slice(6)];
    const item = pick(set.items);
    q.card = { frase: item[0], opts: shuffle([...set.options]), correct: item[1], why: item[2], en: item[3] || "" };
  } else if (q.mode === "conj") {
    const v = pick(S.data.verbos.verbos);
    const tk = pick(TENSE_KEYS);
    const pi = Math.floor(Math.random() * 6);
    const correct = v[tk][pi];
    const pool = new Set([correct]);
    let guard = 0;
    while (pool.size < 4 && guard++ < 80) pool.add(pick(v[pick(TENSE_KEYS)]));
    q.card = { q: v.lemma, meta: `${S.data.verbos.personas[pi]} · ${S.data.verbos.tiempos[tk]} · (${v.en})`, correct, opts: shuffle([...pool]) };
  } else if (q.mode === "tense-id") {
    const v = pick(S.data.verbos.verbos);
    const tk = pick(TENSE_KEYS);
    const pi = Math.floor(Math.random() * 6);
    const T = S.data.verbos.tiempos;
    const pool = new Set([T[tk]]);
    let guard = 0;
    while (pool.size < 4 && guard++ < 40) pool.add(T[pick(TENSE_KEYS)]);
    q.card = { q: v[tk][pi], meta: `${v.lemma} (${v.en}) · ${S.data.verbos.personas[pi]} — which tense is this?`, correct: T[tk], opts: shuffle([...pool]), qSerif: true };
  } else if (q.mode === "voc-es" || q.mode === "voc-en") {
    const t = pick(S.data.vocab.temas);
    const w = pick(t.words);
    const es2en = q.mode === "voc-es";
    const correct = es2en ? w[1] : w[0];
    const pool = new Set([correct]);
    let guard = 0;
    while (pool.size < 4 && guard++ < 60) { const o = pick(t.words); pool.add(es2en ? o[1] : o[0]); }
    q.card = { q: es2en ? w[0] : w[1], meta: t.label, correct, opts: shuffle([...pool]), qSerif: es2en };
  } else if (q.mode === "frase") {
    const s = pick(S.data.frases.situaciones);
    const cands = s.phrases.filter((p) => { const n = p[0].split(/\s+/).length; return n >= 3 && n <= 8; });
    const [es, en] = pick(cands.length ? cands : s.phrases);
    const words = es.split(/\s+/);
    q.card = { en: en.split("(")[0].trim(), words, order: shuffle(words.map((_, i) => i)), built: [], done: false };
  } else if (q.mode === "dic") {
    const now = Date.now();
    const due = S.dic.filter((d) => !d.due || d.due <= now);
    q.card = { w: pick(due.length ? due : S.dic), revealed: false };
  }
  renderQuiz();
}

function renderQuiz() {
  const q = S.quiz, c = q.card;
  const head = `<button class="back" onclick="S.quiz=null;render()">← Practice</button>
    <div class="score"><span>✓ ${q.score}/${q.total}</span><span>streak ${q.streak}</span></div>`;
  if (q.mode.startsWith("drill:")) {
    app.innerHTML = `${head}
      <div class="quiz">
        <div class="q serif" style="font-size:22px">${esc(c.frase)}</div>
        ${c.en ? `<div class="qm">${esc(c.en)}</div>` : `<div class="qm">&nbsp;</div>`}
        <div class="opts">${c.opts.map((o) => `<button class="opt" data-o="${esc(o)}" onclick="answerDrill(this)">${esc(o)}</button>`).join("")}</div>
        <div id="drillWhy" style="margin-top:12px;font-size:14px;text-align:left"></div>
      </div>`;
    return;
  }
  if (q.mode === "frase") {
    app.innerHTML = `${head}
      <div class="quiz"><div class="qm">Build it in Spanish:</div><div style="font-size:17px;margin-bottom:14px">«${esc(c.en)}»</div>
      <div class="built serif">${c.built.map((i) => esc(c.words[i])).join(" ") || "&nbsp;"}</div>
      <div class="wordbank">${c.order.map((i) => `<button class="wtoken ${c.built.includes(i) ? "used" : ""}" onclick="tapToken(${i})">${esc(c.words[i])}</button>`).join("")}</div>
      ${c.done ? `<div style="color:var(--ok);font-weight:700;margin:8px 0">¡Correcto!</div><button class="btn" onclick="nextQuestion()">Next →</button>` : `<button class="btn ghost" onclick="S.quiz.card.built=[];renderQuiz()">Clear</button>`}
      </div>`;
    return;
  }
  if (q.mode === "dic") {
    const w = c.w;
    app.innerHTML = `${head}
      <div class="flash" onclick="S.quiz.card.revealed=!S.quiz.card.revealed;renderQuiz()">
        <div class="wbig">${esc(w.lemma)}</div>
        <div style="margin-top:12px;font-size:17px;color:${c.revealed ? "var(--ink)" : "var(--muted)"}">${c.revealed ? esc(w.es) : "tap to reveal"}</div>
        ${c.revealed && w.nota ? `<div style="margin-top:8px;font-size:14px;color:var(--ink-soft);font-style:italic">${esc(w.nota)}</div>` : ""}
      </div>
      ${c.revealed ? `<div class="btnrow" style="justify-content:center">
        <button class="btn ghost" onclick="gradeCard(false)">Hard ✗</button>
        <button class="btn" onclick="gradeCard(true)">Knew it ✓</button>
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
  setTimeout(nextQuestion, chosen === c.correct ? 700 : 1700);
}

function answerDrill(btn) {
  const q = S.quiz, c = q.card;
  const chosen = btn.dataset.o;
  q.total++;
  document.querySelectorAll(".opt").forEach((b) => {
    b.onclick = null;
    if (b.dataset.o === c.correct) b.classList.add("right");
    else if (b === btn) b.classList.add("wrong");
  });
  const ok = chosen === c.correct;
  if (ok) { q.score++; q.streak++; } else q.streak = 0;
  $("drillWhy").innerHTML = `<b style="color:${ok ? "var(--ok)" : "var(--danger)"}">${ok ? "✓" : "✗"} ${esc(c.correct)}</b> — ${esc(c.why)} <div style="margin-top:8px"><button class="btn" onclick="nextQuestion()">Next →</button></div>`;
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
    <h1>Vocabulary</h1>
    <input type="text" id="wSearch" placeholder="Search everything… (Spanish or English)" oninput="searchWords()" style="margin-bottom:10px">
    <div id="wResults"></div>
    <div class="chips">
      <button class="chip ${mode === "temas" ? "on" : ""}" onclick="go('vocab',{mode:'temas'})">By theme</button>
      <button class="chip ${mode === "frases" ? "on" : ""}" onclick="go('vocab',{mode:'frases'})">Phrases & idioms</button>
    </div>
    ${mode === "temas" ? `
      <div class="chips">${themes.map((t, i) => `<button class="chip ${i === ti ? "on" : ""}" onclick="go('vocab',{mode:'temas',t:${i}})">${esc(t.label)}</button>`).join("")}</div>
      ${themes[ti].words.map(([es, en]) => {
        const saved = S.dic.some((d) => d.lemma === es);
        return `<div class="card row">
          <div style="flex:1;cursor:pointer" onclick="wordSheet('${esc(es).replace(/'/g, "\\'")}','','${esc(en).replace(/'/g, "\\'")}')">
            <span class="serif" style="font-size:17px">${esc(es)}</span>
            <div style="color:var(--muted);font-size:13px">${esc(en)}</div>
          </div>
          <button class="plus ${saved ? "saved" : ""}" onclick="quickSave('${esc(es).replace(/'/g, "\\'")}','${esc(en).replace(/'/g, "\\'")}','');render()">${saved ? "✓" : "+"}</button>
        </div>`;
      }).join("")}
      <p class="hint">Tap the word for its card · + to save it</p>` : `
      <div class="chips">${sits.map((s, i) => `<button class="chip ${i === si ? "on" : ""}" onclick="go('vocab',{mode:'frases',s:${i}})">${esc(s.label)}</button>`).join("")}</div>
      ${sits[si].phrases.map(([es, en]) => `
        <div class="card">
          <div class="serif" style="font-size:17px">${spanish(es, en)}</div>
          <div style="color:var(--muted);font-size:13px;margin-top:2px">${esc(en)}</div>
        </div>`).join("")}
      <p class="hint">Tap any word to investigate it</p>`}`;
}

function searchWords() {
  const q = norm($("wSearch").value.trim());
  const box = $("wResults");
  if (!q || q.length < 2) { box.innerHTML = ""; return; }
  const hits = [];
  for (const t of S.data.vocab.temas) {
    for (const [es, en] of t.words) {
      if (norm(es).includes(q) || norm(en).includes(q)) hits.push([es, en, t.label]);
      if (hits.length >= 30) break;
    }
    if (hits.length >= 30) break;
  }
  if (hits.length < 30) {
    for (const [es, en, pos] of S.data.lexico.lexico) {
      if (norm(es).includes(q) || norm(en).includes(q)) hits.push([es, en, pos]);
      if (hits.length >= 30) break;
    }
  }
  box.innerHTML = hits.length === 0 ? `<p class="hint" style="text-align:left">Not in the offline dictionary. Ask Claude, then save it with a note!</p>` :
    hits.map(([es, en, src]) => `
      <div class="card row">
        <div style="flex:1;cursor:pointer" onclick="wordSheet('${esc(es).replace(/'/g, "\\'")}','','${esc(en).replace(/'/g, "\\'")}')">
          <span class="serif" style="font-size:16px">${esc(es)}</span>
          <span style="color:var(--muted);font-size:11px;margin-left:8px">${esc(src)}</span>
          <div style="color:var(--muted);font-size:13px">${esc(en)}</div>
        </div>
      </div>`).join("");
}

// ═════════ TEXTS ═════════
function renderTextos() {
  if (S.view && S.view.texto != null) return renderTexto(S.view.texto, false);
  if (S.view && S.view.mio != null) return renderTexto(S.view.mio, true);
  if (S.view === "nuevo") return renderNuevoTexto();
  const T = S.data.textos.textos;
  app.innerHTML = `
    <h1>Parallel texts</h1>
    <p class="sub">Readings in Spanish and English, sentence by sentence. Tap Spanish words to investigate them, English sentences to see their partner, and use the highlighter ✏.</p>
    ${["A2", "B1", "B2"].map((lv) => {
      const items = T.map((t, i) => t.lvl === lv ? `
        <div class="card tap row" onclick="go('textos',{texto:${i}})">
          <div><div class="t serif">${esc(t.titulo_es)}</div><div class="s" style="font-family:inherit">${esc(t.titulo_en)}</div></div>
          <span class="lvl">${t.frases.length} sentences</span>
        </div>` : "").join("");
      return items ? `<div class="stitle">Level ${lv}</div>${items}` : "";
    }).join("")}
    <div class="stitle">My texts · ${S.mistextos.length}</div>
    ${S.mistextos.map((t, i) => `
      <div class="card tap row" onclick="go('textos',{mio:${i}})">
        <div><div class="t serif">${esc(t.titulo_es)}</div><div class="s" style="font-family:inherit">${esc(t.titulo_en)}</div></div>
        <span class="lvl">${t.frases.length} sentences</span>
      </div>`).join("")}
    <button class="btn ghost" style="margin-top:6px" onclick="go('textos','nuevo')">+ Add a text</button>
    <div class="notice" style="margin-top:14px"><b>Infinite free library:</b> ask Claude for a Spanish text on any topic with its English translation, paste both here, and the app aligns them sentence by sentence. Try: «Write me a B1 Spanish (Spain) text about [topic], sentence by sentence, with English translation».</div>`;
}

function splitSentences(txt) {
  return txt.replace(/\s+/g, " ").trim().split(/(?<=[.;!?…])\s+/).filter((x) => x.trim());
}

function renderNuevoTexto() {
  app.innerHTML = `
    <button class="back" onclick="go('textos')">← Texts</button>
    <h2>Add a text</h2>
    <p class="sub">Paste the Spanish text and its English translation. The app splits them by sentence and pairs them in order.</p>
    <input type="text" id="ntEs" placeholder="Spanish title (optional)" style="margin-bottom:8px">
    <input type="text" id="ntEn" placeholder="English title (optional)" style="margin-bottom:8px">
    <textarea id="ntSp" rows="5" placeholder="Spanish text…" style="margin-bottom:8px"></textarea>
    <textarea id="ntEng" rows="5" placeholder="English translation…" style="margin-bottom:8px"></textarea>
    <div id="ntErr"></div>
    <button class="btn big" onclick="saveNuevoTexto()">Save to my library</button>`;
}

function saveNuevoTexto() {
  const sp = splitSentences($("ntSp").value), en = splitSentences($("ntEng").value);
  if (!sp.length || !en.length) { $("ntErr").innerHTML = `<div class="err">Both texts are needed.</div>`; return; }
  const n = Math.min(sp.length, en.length);
  const frases = [];
  for (let i = 0; i < n; i++) {
    frases.push([i === n - 1 ? sp.slice(i).join(" ") : sp[i], i === n - 1 ? en.slice(i).join(" ") : en[i]]);
  }
  const warn = sp.length !== en.length ? ` (note: ${sp.length} Spanish vs ${en.length} English sentences — merged the extras at the end)` : "";
  S.mistextos.unshift({
    id: "m" + Date.now(),
    titulo_es: $("ntEs").value.trim() || sp[0].slice(0, 40) + "…",
    titulo_en: $("ntEn").value.trim() || "My text",
    frases,
  });
  saveMis();
  alert("Text saved" + warn);
  go("textos");
}

function renderTexto(i, mio) {
  const t = mio ? S.mistextos[i] : S.data.textos.textos[i];
  const tid = mio ? t.id : "t" + i;
  app.innerHTML = `
    <button class="back" onclick="go('textos')">← Texts</button>
    <div class="row" style="align-items:flex-start">
      <div><h2 class="serif">${esc(t.titulo_es)}</h2>
      <div style="color:var(--muted);font-size:15px;margin-bottom:12px">${esc(t.titulo_en)}${t.lvl ? " · " + t.lvl : ""}</div></div>
      <button class="chip ${S.hlMode ? "on" : ""}" id="hlBtn" onclick="S.hlMode=!S.hlMode;$('hlBtn').classList.toggle('on',S.hlMode);$('hlHint').textContent=S.hlMode?'Highlighter ON: tap words to mark / unmark them':'Tap a Spanish word to investigate · an English sentence to see its partner';">✏ Highlight</button>
    </div>
    <p class="gtext">${t.frases.map(([es, en], si) => `<span class="pr pr-el" data-i="${si}">${spanish(es, en, tid + ":" + si)}</span>`).join(" ")}</p>
    <p class="estext">${t.frases.map(([es, en], si) => `<span class="sp pr pr-es" data-i="${si}">${esc(en)}</span>`).join(" ")}</p>
    <p class="hint" id="hlHint">Tap a Spanish word to investigate · an English sentence to see its partner</p>
    ${mio ? `<button class="btn ghost" style="margin-top:10px" onclick="if(confirm('Delete this text?')){S.mistextos.splice(${i},1);saveMis();go('textos')}">Delete text</button>` : ""}`;
  app.querySelectorAll(".pr-es").forEach((elx) => {
    elx.onclick = () => {
      const si = +elx.dataset.i;
      app.querySelectorAll(".pr").forEach((x) => x.classList.toggle("pair-on", +x.dataset.i === si));
    };
  });
  app.querySelectorAll(".pr-el").forEach((elx) => {
    elx.addEventListener("click", () => {
      const si = +elx.dataset.i;
      app.querySelectorAll(".pr").forEach((x) => x.classList.toggle("pair-on", +x.dataset.i === si));
    });
  });
}

// ═════════ MY WORDS ═════════
function renderDic() {
  const marked = Object.keys(S.hl).length;
  app.innerHTML = `
    <h1>My words</h1>
    <p class="sub">Your personal dictionary: ${S.dic.length} ${S.dic.length === 1 ? "word" : "words"}${marked ? ` · ${marked} highlighted in texts` : ""}. Every word can hold your own notes.</p>
    ${S.dic.length >= 4 ? `<button class="btn" style="margin-bottom:16px" onclick="startQuiz('dic')">Practice with flashcards</button>` : ""}
    ${S.dic.length === 0 ? `<p class="hint" style="text-align:left">Still empty. Tap Spanish words anywhere and hit «Save».</p>` :
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

// ═════════ SETTINGS ═════════
function renderAjustes() {
  app.innerHTML = `
    <h1>Settings</h1>
    <div class="notice">LENGUA runs 100% offline and free: no API, no accounts, no data sent anywhere. Everything lives on your device.</div>
    <div class="stitle">Backup</div>
    <p class="sub">Export your words, notes, highlights and custom texts to move them to another device.</p>
    <div class="btnrow">
      <button class="btn" onclick="exportAll()">Export everything</button>
      <button class="btn ghost" onclick="$('impBox').style.display='block'">Import</button>
    </div>
    <div id="impBox" style="display:none;margin-top:10px">
      <textarea id="impData" rows="4" placeholder="Paste the exported JSON here…"></textarea>
      <button class="btn" style="margin-top:8px" onclick="importAll()">Load backup</button>
    </div>
    <div class="stitle">How to grow LENGUA for free</div>
    <p class="sub">Ask Claude for content and bring it here:</p>
    <p class="sub">· <b>New texts:</b> «Write me a B1 Spanish (Spain) text about [topic] with English translation» → paste it in Texts → + Add a text.</p>
    <p class="sub">· <b>Word questions:</b> ask Claude anything, then save the answer as a note on that word's card.</p>
    <p class="sub">· <b>More course content</b> (verbs, lessons, drills): ask in the LENGUA conversation and it gets added to the app.</p>
    <div class="stitle">Danger zone</div>
    <button class="btn ghost" onclick="if(confirm('Delete EVERYTHING (words, notes, highlights, my texts)?')){['lengua-dic','lengua-hl','lengua-mistextos'].forEach(k=>localStorage.removeItem(k));location.reload()}">Delete all my data</button>`;
}

function exportAll() {
  const blob = JSON.stringify({ dic: S.dic, hl: S.hl, mistextos: S.mistextos, v: 1 });
  navigator.clipboard.writeText(blob).then(
    () => alert("Backup copied to clipboard. Save it anywhere."),
    () => prompt("Copy this JSON:", blob)
  );
}
function importAll() {
  try {
    const d = JSON.parse($("impData").value);
    if (d.dic) S.dic = d.dic;
    if (d.hl) S.hl = d.hl;
    if (d.mistextos) S.mistextos = d.mistextos;
    saveDic(); saveHl(); saveMis();
    alert("Backup loaded ✓"); go("dic");
  } catch (e) { alert("Invalid JSON"); }
}

// ═════════ WORD CARD (offline engine) ═════════
function openSheet(title, bodyHTML) {
  $("sheetTitle").textContent = title;
  $("sheetBody").innerHTML = bodyHTML;
  $("sheetOverlay").classList.add("open");
  $("sheetBody").querySelectorAll(".gw").forEach((el) => {
    el.onclick = (ev) => { ev.stopPropagation(); wordSheet(el.dataset.w, "", ""); };
  });
}
function closeSheet(ev) { if (!ev || ev.target === $("sheetOverlay")) $("sheetOverlay").classList.remove("open"); }

function wordSheet(word, ctxEs, ctxEn) {
  const hits = S.index.get(norm(word)) || [];
  const P = S.data.verbos.personas;
  let html = `<div class="wbig">${esc(word)}</div>`;
  let saveLemma = word, saveEs = ctxEn || "", savePos = "";
  const seen = new Set();
  const parts = [];

  for (const h of hits) {
    if (h.type === "verbo-forma" || h.type === "verbo-lemma") {
      const v = S.data.verbos.verbos[h.vi];
      const k = "v" + h.vi + (h.tk || "");
      if (seen.has(k)) continue; seen.add(k);
      saveLemma = v.lemma; saveEs = v.en; savePos = "verb";
      const uso = h.tk && S.data.verbos.uso[h.tk] ? `<div class="wrow"><div class="wk">When to use it</div><div class="wv">${esc(S.data.verbos.uso[h.tk])}</div></div>` : "";
      parts.push(`
        <div class="wrow"><div class="wk">Verb</div>
        <div class="wv"><b class="serif">${esc(v.lemma)}</b> = ${esc(v.en)}${h.type === "verbo-forma" ? `<br>This form is <b>${esc(h.tiempo)}</b>${h.persona !== "—" ? `, person <b class="serif">${esc(h.persona)}</b>` : ""}.` : ""}</div></div>
        ${uso}
        <div class="tblwrap"><table><tr><th></th><th>Pres.</th><th>Pret.</th><th>Imperf.</th><th>Subj.</th></tr>
        ${P.map((p, j) => `<tr><td>${esc(p)}</td><td class="gr">${esc(v.pres[j])}</td><td class="gr">${esc(v.pret[j])}</td><td class="gr">${esc(v.imp[j])}</td><td class="gr">${esc(v.subj[j])}</td></tr>`).join("")}</table></div>
        <div class="btnrow"><button class="btn ghost" onclick="closeSheet();go('curso',{verb:${h.vi}})">All 8 tenses + usage guide →</button></div>
        ${v.nota ? `<div class="wrow"><div class="wk">Note</div><div class="wv">${esc(v.nota)}</div></div>` : ""}`);
    } else if (h.type === "vocab") {
      const k = "w" + h.es; if (seen.has(k)) continue; seen.add(k);
      if (savePos !== "verb") { saveLemma = h.es; saveEs = h.en; }
      parts.push(`<div class="wrow"><div class="wk">Vocabulary · ${esc(h.tema)}</div><div class="wv"><b class="serif">${esc(h.es)}</b> = ${esc(h.en)}</div></div>`);
    } else if (h.type === "lexico") {
      const k = "l" + h.es; if (seen.has(k)) continue; seen.add(k);
      if (savePos !== "verb") { saveLemma = h.es; saveEs = h.en; savePos = h.pos; }
      parts.push(`<div class="wrow"><div class="wk">${esc(h.pos)}</div><div class="wv"><b class="serif">${esc(h.es)}</b> = ${esc(h.en)}${h.nota ? `<br><span style="color:var(--ink-soft)">${esc(h.nota)}</span>` : ""}</div></div>`);
    }
  }

  if (!parts.length) {
    const hints = morfoHints(word);
    parts.push(`<div class="wrow"><div class="wk">Not in the offline dictionary (yet)</div><div class="wv">${ctxEn ? `In this sentence, the English says: «${esc(ctxEn)}».` : ""}</div></div>`);
    if (hints.length) parts.push(`<div class="wrow"><div class="wk">Clues from the ending</div><div class="wv">${hints.map((h) => "· " + esc(h)).join("<br>")}</div></div>`);
    parts.push(`<div class="wrow"><div class="wv" style="color:var(--ink-soft)">Investigate: ask Claude «what does ${esc(word)} mean and why does it have this form?» and save what you learn here as a note.</div></div>`);
  }

  if (ctxEs && parts.length) {
    parts.unshift(`<div class="wrow"><div class="wk">In the sentence</div><div class="wv serif" style="font-size:16px">${esc(ctxEs)}</div>${ctxEn ? `<div class="wv" style="color:var(--muted);font-size:13px">${esc(ctxEn)}</div>` : ""}</div>`);
  }

  const entry = S.dic.find((d) => d.lemma === saveLemma || d.lemma === word);
  html += `<div class="wpos">${esc(savePos)}</div>` + parts.join("");
  html += `
    <div class="stitle" style="margin-top:14px">My note</div>
    <textarea id="notaBox" rows="2" placeholder="Write what you discover about this word…">${esc(entry ? entry.nota || "" : "")}</textarea>
    <div class="btnrow">
      <button class="btn" id="saveWordBtn">${entry ? "Update note ✎" : "Save word"}</button>
    </div>`;
  openSheet("Word card", html);
  $("saveWordBtn").onclick = () => {
    const nota = $("notaBox").value.trim();
    let e = S.dic.find((d) => d.lemma === saveLemma || d.lemma === word);
    if (!e) { e = { lemma: saveLemma, es: saveEs || "—", pos: savePos, nota: "", date: Date.now(), box: 0, due: 0 }; S.dic.unshift(e); }
    e.nota = nota;
    saveDic();
    $("saveWordBtn").textContent = "Saved ✓";
    if (S.tab === "dic" || S.tab === "vocab") render();
  };
}

// ————— boot —————
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
updateDicCount();
render();
loadData().then(render).catch(() => {
  app.innerHTML = `<div class="err">Could not load data. Check your connection and reload (first load needs internet; after that it works offline).</div>`;
});
