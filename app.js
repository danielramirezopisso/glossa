// ΓΛΩΣΣΑ — griego desde el español · app.js
"use strict";

// ————— state —————
const S = {
  tab: "curso", view: null, // sub-view per tab
  data: {}, // loaded JSON
  dic: JSON.parse(localStorage.getItem("glossa-dic") || "[]"),
  key: localStorage.getItem("glossa-key") || "",
  level: localStorage.getItem("glossa-level") || "A2",
  cache: JSON.parse(localStorage.getItem("glossa-aicache") || "{}"),
  quiz: null, flash: null, article: null, activePair: null,
};

const $ = (id) => document.getElementById(id);
const app = $("app");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function saveDic() { localStorage.setItem("glossa-dic", JSON.stringify(S.dic)); updateDicCount(); }
function saveCache() { try { localStorage.setItem("glossa-aicache", JSON.stringify(S.cache)); } catch (e) { S.cache = {}; } }
function updateDicCount() { $("dicCount").textContent = S.dic.length ? `Λεξικό·${S.dic.length}` : "Λεξικό"; }

// ————— data loading —————
async function loadData() {
  const files = ["verbos", "vocab", "lecciones", "frases", "textos"];
  await Promise.all(files.map(async (f) => {
    const r = await fetch(`data/${f}.json`);
    S.data[f] = await r.json();
  }));
}

// ————— navigation —————
function go(tab, view = null) {
  S.tab = tab; S.view = view; S.quiz = null; S.flash = null;
  document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  render();
  window.scrollTo(0, 0);
}

function render() {
  if (!S.data.verbos) { app.innerHTML = `<div class="spinner"></div><div class="spinlbl">Cargando ΓΛΩΣΣΑ…</div>`; return; }
  const r = { curso: renderCurso, ejercicios: renderEjercicios, vocab: renderVocab, textos: renderTextos, dic: renderDic, ajustes: renderAjustes }[S.tab];
  r();
  bindGreekWords();
}

// tappable Greek words: any .gw span
function bindGreekWords() {
  app.querySelectorAll(".gw").forEach((el) => {
    el.onclick = (ev) => { ev.stopPropagation(); wordSheet(el.dataset.w, el.dataset.el || "", el.dataset.es || ""); };
  });
}
function greekSpan(word, ctxEl, ctxEs) {
  const clean = word.replace(/[.,;·!;»«"'()\[\]…:]/g, "");
  if (!clean || !/[Α-Ωα-ωάέήίόύώϊϋΐΰ]/.test(clean)) return esc(word);
  return `<span class="gw" data-w="${esc(clean)}" data-el="${esc(ctxEl)}" data-es="${esc(ctxEs)}">${esc(word)}</span>`;
}
function greekText(sentence, ctxEs) {
  return sentence.split(/\s+/).map((w) => greekSpan(w, sentence, ctxEs)).join(" ");
}

// ═════════ CURSO ═════════
function renderCurso() {
  if (S.view && S.view.lesson) return renderLesson(S.view.lesson);
  if (S.view && S.view.verb) return renderVerb(S.view.verb);
  const L = S.data.lecciones.lecciones, V = S.data.verbos.verbos;
  app.innerHTML = `
    <h1>El curso</h1>
    <p class="sub">Gramática del griego moderno explicada desde el español. Toca cualquier ejemplo griego para analizarlo palabra a palabra.</p>
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
      if (b.t === "tbl") return `<div class="tblwrap"><table>${b.h.some(x=>x) ? `<tr>${b.h.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>` : ""}${b.r.map((row) => `<tr>${row.map((c) => `<td class="${/[Α-Ωα-ω]/.test(c) ? "gr" : ""}">${/[Α-Ωα-ω]/.test(c) ? c.split(/\s+/).map(w=>greekSpan(w, c, "")).join(" ") : esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
      return `<div class="ex" onclick="sentenceSheet('${esc(b.el).replace(/'/g,"\\'")}','${esc(b.es).replace(/'/g,"\\'")}')"><div class="el">${greekText(b.el, b.es)}</div><div class="es">${esc(b.es)} · toca la frase para analizar</div></div>`;
    }).join("")}
    <div class="btnrow">
      <button class="btn ghost" onclick="tutorSheet('Más ejemplos y mini-ejercicios sobre: ${esc(l.title)} (griego moderno)')">Más ejemplos</button>
      <button class="btn ghost" onclick="tutorSheet('Errores típicos de un hispanohablante con: ${esc(l.title)} (griego moderno)')">Errores típicos</button>
    </div>`;
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
    <div class="btnrow">
      <button class="btn" onclick="quickSave('${esc(v.lemma)}','${esc(v.es)}','verbo');render()" ${saved ? "disabled" : ""}>${saved ? "En tu λεξικό ✓" : "Guardar en mi λεξικό"}</button>
      <button class="btn ghost" onclick="tutorSheet('Frases de ejemplo naturales con el verbo ${esc(v.lemma)} (${esc(v.es)}) en presente, pasado y futuro, con traducción al español')">Ejemplos de uso</button>
    </div>`;
}

// ═════════ EJERCICIOS ═════════
function renderEjercicios() {
  if (S.quiz) return renderQuiz();
  app.innerHTML = `
    <h1>Práctica</h1>
    <p class="sub">Ejercicios infinitos generados desde el contenido del curso. Todo funciona offline y no gasta nada.</p>
    <div class="card tap" onclick="startQuiz('conj')"><div class="t">Conjugación de verbos</div><div class="s">¿Cómo se dice «nosotros, aoristo, γράφω»?</div></div>
    <div class="card tap" onclick="startQuiz('voc-el')"><div class="t">Vocabulario: griego → español</div><div class="s">Reconoce la palabra griega</div></div>
    <div class="card tap" onclick="startQuiz('voc-es')"><div class="t">Vocabulario: español → griego</div><div class="s">Encuentra la palabra griega</div></div>
    <div class="card tap" onclick="startQuiz('frase')"><div class="t">Construye la frase</div><div class="s">Ordena las palabras de una frase real</div></div>
    <div class="card tap" onclick="startQuiz('dic')"><div class="t">Repaso de mi λεξικό</div><div class="s">${S.dic.length < 4 ? "Guarda al menos 4 palabras para practicar" : `Tarjetas con tus ${S.dic.length} palabras (repetición espaciada)`}</div></div>`;
}

function startQuiz(mode) {
  if (mode === "dic" && S.dic.length < 4) return;
  S.quiz = { mode, score: 0, total: 0, streak: 0 };
  nextQuestion();
}

function nextQuestion() {
  const q = S.quiz;
  if (q.mode === "conj") {
    const v = pick(S.data.verbos.verbos.filter((x) => x.tipo !== "irregular" || Math.random() < 0.5));
    const tenses = [["pres", "presente"], ["imp", "imperfecto"], ["aor", "aoristo"]];
    const [tk, tn] = pick(tenses);
    const pi = Math.floor(Math.random() * 6);
    const correct = v[tk][pi];
    const pool = new Set([correct]);
    while (pool.size < 4) pool.add(pick([...v.pres, ...v.imp, ...v.aor]));
    q.card = { q: v.lemma, meta: `${S.data.verbos.personas[pi]} · ${tn} · (${v.es})`, correct, opts: shuffle([...pool]) };
  } else if (q.mode === "voc-el" || q.mode === "voc-es") {
    const t = pick(S.data.vocab.temas);
    const w = pick(t.words);
    const el2es = q.mode === "voc-el";
    const correct = el2es ? w[1] : w[0];
    const pool = new Set([correct]);
    while (pool.size < 4) { const o = pick(t.words); pool.add(el2es ? o[1] : o[0]); }
    q.card = { q: el2es ? w[0] : w[1], meta: t.label, correct, opts: shuffle([...pool]), qSerif: el2es };
  } else if (q.mode === "frase") {
    const s = pick(S.data.frases.situaciones);
    const [el, es] = pick(s.phrases.filter((p) => p[0].split(/\s+/).length >= 3 && p[0].split(/\s+/).length <= 8));
    const words = el.split(/\s+/);
    q.card = { es: es.split("(")[0].trim(), words, order: shuffle(words.map((_, i) => i)), built: [], done: false };
  } else if (q.mode === "dic") {
    const now = Date.now();
    const due = S.dic.filter((d) => !d.due || d.due <= now);
    const list = due.length ? due : S.dic;
    q.card = { w: pick(list), revealed: false };
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
      ${c.done ? `<div style="color:var(--ok);font-weight:700;margin:8px 0">Σωστά! ¡Correcto!</div><button class="btn" onclick="nextQuestion()">Siguiente →</button>` : `<button class="btn ghost" onclick="c=S.quiz.card;c.built=[];renderQuiz()">Borrar</button>`}
      </div>`;
    return;
  }
  if (q.mode === "dic") {
    const w = c.w;
    app.innerHTML = `${head}
      <div class="flash" onclick="S.quiz.card.revealed=!S.quiz.card.revealed;renderQuiz()">
        <div class="wbig">${esc(w.lemma)}</div>
        <div style="margin-top:12px;font-size:17px;color:${c.revealed ? "var(--ink)" : "var(--muted)"}">${c.revealed ? esc(w.es) : "toca para revelar"}</div>
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
    const days = [0, 1, 3, 7, 21][entry.box];
    entry.due = Date.now() + days * 864e5;
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
          <div style="flex:1;cursor:pointer" onclick="wordSheet('${esc(el).replace(/'/g,"\\'")}','','${esc(es).replace(/'/g,"\\'")}')">
            <span class="serif" style="font-size:17px">${esc(el)}</span>
            <div style="color:var(--muted);font-size:13px">${esc(es)}</div>
          </div>
          <button class="plus ${saved ? "saved" : ""}" onclick="quickSave('${esc(el).replace(/'/g,"\\'")}','${esc(es).replace(/'/g,"\\'")}','');render()">${saved ? "✓" : "+"}</button>
        </div>`;
      }).join("")}
      <p class="hint">Toca la palabra para su ficha · + para guardarla</p>` : `
      <div class="chips">${sits.map((s, i) => `<button class="chip ${i === si ? "on" : ""}" onclick="go('vocab',{mode:'frases',s:${i}})">${esc(s.label)}</button>`).join("")}</div>
      ${sits[si].phrases.map(([el, es]) => `
        <div class="card tap" onclick="sentenceSheet('${esc(el).replace(/'/g,"\\'")}','${esc(es).replace(/'/g,"\\'")}')">
          <div class="serif" style="font-size:17px">${greekText(el, es)}</div>
          <div style="color:var(--muted);font-size:13px;margin-top:2px">${esc(es)}</div>
        </div>`).join("")}
      <p class="hint">Toca una palabra para su ficha · toca la tarjeta para la gramática de la frase</p>`}`;
}

// ═════════ TEXTOS ═════════
function renderTextos() {
  if (S.view && S.view.texto != null) return renderTexto(S.view.texto);
  if (S.view === "noticia" && S.article) return renderArticle();
  const T = S.data.textos.textos;
  const lvls = ["A1", "A2", "B1"];
  app.innerHTML = `
    <h1>Textos paralelos</h1>
    <p class="sub">Lecturas en griego y español, frase a frase. Toca palabras griegas para su ficha, y frases españolas para ver su pareja griega y su gramática.</p>
    ${lvls.map((lv) => `
      <div class="stitle">Nivel ${lv}</div>
      ${T.map((t, i) => t.lvl === lv ? `
        <div class="card tap row" onclick="go('textos',{texto:${i}})">
          <div><div class="t serif">${esc(t.titulo_el)}</div><div class="s" style="font-family:inherit">${esc(t.titulo_es)}</div></div>
          <span class="lvl">${t.frases.length} frases</span>
        </div>` : "").join("")}`).join("")}
    <div class="stitle">Noticias de hoy (con IA)</div>
    ${S.key ? `
      <div class="chips">${["Grecia", "Mundo", "Tecnología", "Deportes", "Cultura"].map((t) => `<button class="chip" onclick="loadNews('${t}')">${t}</button>`).join("")}</div>
      <div class="chips">${["A1", "A2", "B1", "B2"].map((l) => `<button class="chip ${S.level === l ? "on" : ""}" onclick="S.level='${l}';localStorage.setItem('glossa-level','${l}');render()">${l}</button>`).join("")}</div>
      <div id="newsErr"></div>` : `
      <div class="notice">Para generar artículos de noticias reales en griego necesitas conectar tu clave API en <b style="cursor:pointer;color:var(--thalassa)" onclick="go('ajustes')">Ajustes ⚙</b>. Todo lo demás funciona sin ella.</div>`}`;
}

function renderTexto(i) {
  const t = S.data.textos.textos[i];
  app.innerHTML = `
    <button class="back" onclick="go('textos')">← Textos</button>
    <h2 class="serif">${esc(t.titulo_el)}</h2>
    <div style="color:var(--muted);font-size:15px;margin-bottom:16px">${esc(t.titulo_es)} · ${t.lvl}</div>
    ${parallelHTML(t.frases)}
    <p class="hint">Toca una palabra griega para su ficha · toca una frase española para ver su pareja y su gramática</p>`;
  bindPairs(t.frases);
}

function parallelHTML(frases) {
  return `
    <p class="gtext">${frases.map(([el, es], i) => `<span class="pr pr-el" data-i="${i}">${greekText(el, es)}</span>`).join(" ")}</p>
    <p class="estext">${frases.map(([el, es], i) => `<span class="sp pr pr-es" data-i="${i}">${esc(es)}</span>`).join(" ")}</p>`;
}

function bindPairs(frases) {
  app.querySelectorAll(".pr-es").forEach((el) => {
    el.onclick = () => {
      const i = +el.dataset.i;
      app.querySelectorAll(".pr").forEach((x) => x.classList.toggle("pair-on", +x.dataset.i === i));
      sentenceSheet(frases[i][0], frases[i][1]);
    };
  });
  app.querySelectorAll(".pr-el").forEach((el) => {
    el.addEventListener("click", () => {
      const i = +el.dataset.i;
      app.querySelectorAll(".pr").forEach((x) => x.classList.toggle("pair-on", +x.dataset.i === i));
    });
  });
}

async function loadNews(topic) {
  $("newsErr").innerHTML = `<div class="spinner"></div><div class="spinlbl">Buscando noticias y escribiendo tu artículo…</div>`;
  try {
    const shape = `{"titulo_el":"...","titulo_es":"...","fuente":"medio","frases":[["frase griega","traducción"],["...","..."]]}`;
    const prompt = `Busca en la web una noticia real y reciente sobre: noticias de ${topic}. Redacta tú (sin copiar texto literal) un artículo breve EN GRIEGO MODERNO (δημοτική), nivel ${S.level} MCER, 10-14 frases que fluyan como texto periodístico, con traducción española alineada. Responde SOLO con JSON válido, sin markdown:\n${shape}`;
    const text = await callClaude(prompt, true);
    const json = JSON.parse(text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)[0]);
    S.article = json;
    go("textos", "noticia");
  } catch (e) {
    console.error(e);
    $("newsErr").innerHTML = `<div class="err">No se pudo generar el artículo. Revisa tu clave API en Ajustes o inténtalo de nuevo.</div>`;
  }
}

function renderArticle() {
  const a = S.article;
  app.innerHTML = `
    <button class="back" onclick="S.article=null;go('textos')">← Textos</button>
    <h2 class="serif">${esc(a.titulo_el)}</h2>
    <div style="color:var(--muted);font-size:15px;margin-bottom:4px">${esc(a.titulo_es)}</div>
    ${a.fuente ? `<div style="color:var(--muted);font-size:12px;margin-bottom:16px">Basado en: ${esc(a.fuente)} · Nivel ${S.level}</div>` : ""}
    ${parallelHTML(a.frases)}
    <p class="hint">Toca palabras y frases para que el tutor te las explique</p>`;
  bindPairs(a.frases);
  bindGreekWords();
}

// ═════════ ΛΕΞΙΚΟ ═════════
function renderDic() {
  app.innerHTML = `
    <h1>Το λεξικό μου</h1>
    <p class="sub">Tu diccionario personal: ${S.dic.length} ${S.dic.length === 1 ? "palabra" : "palabras"}. Crece cada vez que guardas algo desde cualquier sección.</p>
    ${S.dic.length >= 4 ? `<button class="btn" style="margin-bottom:16px" onclick="go('ejercicios');startQuiz('dic')">Practicar con tarjetas</button>` : ""}
    ${S.dic.length === 0 ? `<p class="hint" style="text-align:left">Aún está vacío. Toca palabras griegas en cualquier sección y pulsa «Guardar».</p>` :
      S.dic.map((v, i) => `
        <div class="card row">
          <div style="flex:1;cursor:pointer" onclick="wordSheet('${esc(v.lemma).replace(/'/g,"\\'")}','','${esc(v.es).replace(/'/g,"\\'")}')">
            <span class="serif" style="font-size:17px">${esc(v.lemma)}</span>
            ${v.pos ? `<span style="color:var(--muted);font-size:12px;margin-left:8px">${esc(v.pos)}</span>` : ""}
            <div style="color:var(--ink-soft);font-size:13px">${esc(v.es)}</div>
          </div>
          <button class="plus" onclick="S.dic.splice(${i},1);saveDic();render()">×</button>
        </div>`).join("")}`;
}

function quickSave(lemma, es, pos) {
  if (S.dic.some((d) => d.lemma === lemma)) return;
  S.dic.unshift({ lemma, es, pos, date: Date.now(), box: 0, due: 0 });
  saveDic();
}

// ═════════ AJUSTES ═════════
function renderAjustes() {
  app.innerHTML = `
    <h1>Ajustes</h1>
    <div class="stitle">Modo tutor con IA</div>
    <p class="sub">Todo el curso, los textos y los ejercicios funcionan offline y gratis. Si además quieres el tutor IA (fichas de palabras a fondo, análisis de frases, preguntas libres y noticias del día en griego), conecta una clave API de Anthropic. Se guarda solo en tu dispositivo y pagas solo lo que usas (céntimos).</p>
    <input type="password" id="keyInput" placeholder="sk-ant-..." value="${esc(S.key)}" style="margin-bottom:10px">
    <div class="btnrow">
      <button class="btn" onclick="S.key=$('keyInput').value.trim();localStorage.setItem('glossa-key',S.key);render()">Guardar clave</button>
      ${S.key ? `<button class="btn ghost" onclick="S.key='';localStorage.removeItem('glossa-key');render()">Quitar clave</button>` : ""}
    </div>
    <p class="sub" style="margin-top:8px">${S.key ? "✓ Clave conectada: el modo tutor está activo." : "Sin clave: modo 100% offline (el tutor mostrará las fichas básicas del curso)."}</p>
    <p class="sub">Consigue una clave en console.anthropic.com → API keys.</p>
    <div class="stitle">Pregunta libre al tutor</div>
    <p class="sub">Cualquier duda de griego: «¿cuál es la diferencia entre ξέρω y γνωρίζω?», «¿cómo se dice tengo sueño?»…</p>
    <textarea id="qInput" rows="2" placeholder="Escribe tu pregunta…" style="margin-bottom:10px"></textarea>
    <button class="btn" onclick="tutorSheet($('qInput').value.trim())">Preguntar</button>
    <div class="stitle">Datos</div>
    <div class="btnrow">
      <button class="btn ghost" onclick="navigator.clipboard.writeText(JSON.stringify(S.dic));alert('Λεξικό copiado al portapapeles como JSON')">Exportar mi λεξικό</button>
      <button class="btn ghost" onclick="if(confirm('¿Borrar caché de respuestas del tutor?')){S.cache={};saveCache();alert('Hecho')}">Vaciar caché IA</button>
    </div>`;
}

// ═════════ SHEET (ficha / gramática / tutor) ═════════
function openSheet(title, bodyHTML) {
  $("sheetTitle").textContent = title;
  $("sheetBody").innerHTML = bodyHTML;
  $("sheetOverlay").classList.add("open");
  $("sheetBody").querySelectorAll(".gw").forEach((el) => {
    el.onclick = (ev) => { ev.stopPropagation(); wordSheet(el.dataset.w, el.dataset.el || "", el.dataset.es || ""); };
  });
}
function closeSheet(ev) { if (!ev || ev.target === $("sheetOverlay")) $("sheetOverlay").classList.remove("open"); }

function offlineLookup(word) {
  // search verbs + vocab for a static match
  const v = S.data.verbos.verbos.find((x) => x.lemma.split(" / ").some((l) => l === word) || x.pres.includes(word) || x.aor.includes(word) || x.imp.includes(word));
  if (v) {
    const where = v.pres.includes(word) ? "presente" : v.aor.includes(word) ? "aoristo" : v.imp.includes(word) ? "imperfecto" : "lemma";
    const idx = (v[{presente:"pres",aoristo:"aor",imperfecto:"imp"}[where]] || []).indexOf(word);
    return { lemma: v.lemma, pos: "verbo", es: v.es, extra: where !== "lemma" ? `Forma de ${where}, persona «${S.data.verbos.personas[idx]}»` : v.nota };
  }
  for (const t of S.data.vocab.temas) {
    const w = t.words.find(([el]) => el === word || el.split(" / ").includes(word) || el.replace(/^(ο|η|το|οι|τα)\s/, "") === word);
    if (w) return { lemma: w[0], pos: "", es: w[1], extra: `Tema: ${t.label}` };
  }
  return null;
}

async function wordSheet(word, ctxEl, ctxEs) {
  const local = offlineLookup(word);
  const key = "w:" + word + "|" + ctxEl;
  const saved = () => S.dic.some((d) => d.lemma === (S.cache[key]?.lemma || local?.lemma || word));
  const saveBtn = (lemma, es, pos) => `<div class="btnrow">
    <button class="btn" ${saved() ? "disabled" : ""} onclick="quickSave('${esc(lemma).replace(/'/g,"\\'")}','${esc(es).replace(/'/g,"\\'")}','${esc(pos)}');wordSheet('${esc(word).replace(/'/g,"\\'")}','${esc(ctxEl).replace(/'/g,"\\'")}','${esc(ctxEs).replace(/'/g,"\\'")}')">${saved() ? "Guardada ✓" : "Guardar palabra"}</button>
    ${S.key ? `<button class="btn ghost" onclick="tutorSheet('Conjugación o declinación completa de «${esc(lemma)}» en griego moderno, con explicación')">Formas completas</button>` : ""}
  </div>`;

  if (S.cache[key]) { renderWordCard(word, S.cache[key], saveBtn); return; }

  if (!S.key) {
    if (local) {
      openSheet("Ficha de palabra", `
        <div class="wbig">${esc(word)}</div>
        ${local.lemma !== word ? `<div style="color:var(--muted)">→ ${esc(local.lemma)}</div>` : ""}
        <div class="wpos">${esc(local.pos || "")}</div>
        <div class="wrow"><div class="wk">Español</div><div class="wv">${esc(local.es)}</div></div>
        ${local.extra ? `<div class="wrow"><div class="wk">Nota</div><div class="wv">${esc(local.extra)}</div></div>` : ""}
        <p class="sub" style="margin-top:10px">Para morfología, etimología y el «porqué» de cada forma, conecta el tutor IA en Ajustes.</p>
        ${saveBtn(local.lemma, local.es, local.pos)}`);
    } else {
      openSheet("Ficha de palabra", `
        <div class="wbig">${esc(word)}</div>
        <p class="sub" style="margin-top:10px">Esta palabra no está en el contenido offline. Conecta el tutor IA en Ajustes para analizar cualquier palabra, o guárdala y pregúntame en Claude.</p>
        ${saveBtn(word, ctxEs || "—", "")}`);
    }
    return;
  }

  openSheet("Ficha de palabra", `<div class="spinner"></div><div class="spinlbl">Analizando «${esc(word)}»…</div>`);
  try {
    const ctx = ctxEl ? `en la frase: «${ctxEl}» (traducción: «${ctxEs}»)` : "(sin contexto)";
    const prompt = `Palabra griega: «${word}» ${ctx}.\nExplica para un hispanohablante que aprende griego. Responde SOLO con JSON válido, sin markdown:\n{"lemma":"forma de diccionario","pos":"categoría gramatical","es":"equivalente español","por_que":"por qué tiene exactamente esta forma aquí, 1-2 frases","morfologia":"raíz + terminación y qué indica cada parte","etimologia":"origen y conexiones con el español, 1-2 frases"}`;
    const text = await callClaude(prompt, false);
    const d = JSON.parse(text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)[0]);
    S.cache[key] = d; saveCache();
    renderWordCard(word, d, saveBtn);
  } catch (e) {
    openSheet("Ficha de palabra", `<div class="err">No se pudo analizar. Revisa tu clave API o inténtalo de nuevo.</div>`);
  }
}

function renderWordCard(word, d, saveBtn) {
  openSheet("Ficha de palabra", `
    <div style="display:flex;align-items:baseline;gap:10px"><span class="wbig">${esc(word)}</span>${d.lemma && d.lemma !== word ? `<span style="color:var(--muted)">→ ${esc(d.lemma)}</span>` : ""}</div>
    <div class="wpos">${esc(d.pos || "")}</div>
    ${d.es ? `<div class="wrow"><div class="wk">Español</div><div class="wv">${esc(d.es)}</div></div>` : ""}
    ${d.por_que ? `<div class="wrow"><div class="wk">Por qué esta forma</div><div class="wv">${esc(d.por_que)}</div></div>` : ""}
    ${d.morfologia ? `<div class="wrow"><div class="wk">Morfología</div><div class="wv">${esc(d.morfologia)}</div></div>` : ""}
    ${d.etimologia ? `<div class="wrow"><div class="wk">Etimología</div><div class="wv">${esc(d.etimologia)}</div></div>` : ""}
    ${saveBtn(d.lemma || word, d.es || "", d.pos || "")}`);
}

async function sentenceSheet(el, es) {
  const key = "s:" + el;
  if (S.cache[key]) { renderSentCard(el, es, S.cache[key]); return; }
  if (!S.key) {
    openSheet("Gramática de la frase", `
      <div class="serif" style="font-size:19px;margin-bottom:4px">${greekText(el, es)}</div>
      <div style="color:var(--muted);font-size:14px;margin-bottom:14px">${esc(es)}</div>
      <p class="sub">Toca cualquier palabra de arriba para buscarla en el contenido offline. Para el análisis gramatical completo de la frase (tiempo, estructura, conjugación del verbo), conecta el tutor IA en Ajustes ⚙.</p>`);
    return;
  }
  openSheet("Gramática de la frase", `<div class="spinner"></div><div class="spinlbl">Analizando la frase…</div>`);
  try {
    const prompt = `Frase en griego moderno: «${el}» (traducción: «${es}»).\nAnaliza para un hispanohablante. Responde SOLO con JSON válido, sin markdown:\n{"tiempo":"tiempo/estructura principal en español","explicacion":"por qué usa este tiempo/estructura y cómo se construye, 2-3 frases","verbo":"lemma del verbo principal","conj":["forma εγώ","forma εσύ","forma αυτός","forma εμείς","forma εσείς","forma αυτοί"],"nota":"un detalle útil o curioso"}`;
    const text = await callClaude(prompt, false);
    const d = JSON.parse(text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)[0]);
    S.cache[key] = d; saveCache();
    renderSentCard(el, es, d);
  } catch (e) {
    openSheet("Gramática de la frase", `<div class="err">No se pudo analizar. Revisa tu clave API o inténtalo de nuevo.</div>`);
  }
}

function renderSentCard(el, es, d) {
  const P = S.data.verbos.personas;
  openSheet("Gramática de la frase", `
    <div class="serif" style="font-size:19px;margin-bottom:2px">${greekText(el, es)}</div>
    <div style="color:var(--muted);font-size:14px;margin-bottom:12px">${esc(es)}</div>
    <div style="display:inline-block;background:var(--honey);font-weight:700;font-size:13px;padding:5px 12px;border-radius:8px;margin-bottom:12px">${esc(d.tiempo || "")}</div>
    <p class="lx">${esc(d.explicacion || "")}</p>
    ${d.conj && d.conj.length === 6 ? `<div class="tblwrap"><table><tr><th colspan="2">${esc(d.verbo || "")} — conjugación</th></tr>${d.conj.map((f, i) => `<tr><td>${P[i]}</td><td class="gr">${esc(f)}</td></tr>`).join("")}</table></div>` : ""}
    ${d.nota ? `<p class="lx" style="font-style:italic;color:var(--ink-soft)">${esc(d.nota)}</p>` : ""}
    ${S.key ? `<div class="btnrow"><button class="btn ghost" onclick="tutorSheet('Explícame en detalle: ${esc(d.tiempo || "esta estructura")} en griego moderno, con ejemplos')">Lección completa</button></div>` : ""}`);
}

async function tutorSheet(question) {
  if (!question) return;
  if (!S.key) { openSheet("Tutor", `<p class="sub">Para preguntas libres necesitas conectar tu clave API en Ajustes ⚙. Mientras tanto, ¡pregúntame directamente en Claude!</p>`); return; }
  const key = "t:" + question;
  if (S.cache[key]) { openSheet("Lección del tutor", `<div style="white-space:pre-wrap;font-size:15px;line-height:1.65">${esc(S.cache[key])}</div>`); return; }
  openSheet("Lección del tutor", `<div class="spinner"></div><div class="spinlbl">Preparando la lección…</div>`);
  try {
    const prompt = `${question}\n\nResponde en español para un estudiante de griego moderno de nivel ${S.level}. Claro y conciso (máx ~250 palabras), sin markdown; ejemplos en griego con traducción entre paréntesis.`;
    const text = await callClaude(prompt, false);
    S.cache[key] = text; saveCache();
    openSheet("Lección del tutor", `<div style="white-space:pre-wrap;font-size:15px;line-height:1.65">${esc(text)}</div>`);
  } catch (e) {
    openSheet("Lección del tutor", `<div class="err">No se pudo contactar con el tutor. Revisa tu clave API.</div>`);
  }
}

// ————— Anthropic API (clave propia del usuario, directa desde el navegador) —————
async function callClaude(prompt, useSearch) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": S.key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// ————— boot —————
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
updateDicCount();
render();
loadData().then(render).catch(() => {
  app.innerHTML = `<div class="err">No se pudieron cargar los datos. Comprueba tu conexión y recarga.</div>`;
});
