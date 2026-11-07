/* Lecteur de session interactif — Éditions Allumées.
   Tout fonctionne dans le navigateur : aucune donnée envoyée, aucun traceur, aucun compte.
   Les notes (tâche, parking, clôture) restent sur l'appareil (localStorage), uniquement pour ton confort. */
(function () {
  "use strict";
  const C = window.CFG; const IMG = "../img/";
  const app = document.getElementById("app");
  const $ = (h) => { const d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstElementChild; };
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ea-" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ea-" + k, JSON.stringify(v)); } catch (e) {} },
  };
  const S = { tache: "", miette: "", parking: [], cloture: {}, debut: null };

  /* ---------- Son : carillon doux + ambiances générées (pas de fichiers, pas de droits) ---------- */
  let ctx = null, amb = null, master = null;
  const audio = () => { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = store.get("vol", 0.6); master.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); return ctx; };
  function chime() {
    const a = audio(); const t0 = a.currentTime;
    [[784, 0], [1046.5, 0.22]].forEach(([f, d]) => [1, 2, 3.99].forEach((h, i) => {
      const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f * h; o.type = "sine";
      const v = [0.16, 0.06, 0.02][i]; g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(v, t0 + d + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 2);
      o.connect(g).connect(master); o.start(t0 + d); o.stop(t0 + d + 2.1);
    }));
  }
  function noiseBuffer(a, sec) { const b = a.createBuffer(1, a.sampleRate * sec, a.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; } return b; }
  function ambiance(kind) {
    store.set("amb", kind);
    if (amb) { amb.forEach((n) => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} }); amb = null; }
    if (kind === "silence") return;
    const a = audio(); const src = a.createBufferSource(); src.buffer = noiseBuffer(a, 4); src.loop = true;
    const f = a.createBiquadFilter(), g = a.createGain(); const nodes = [src];
    if (kind === "pluie") { f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.4; g.gain.value = 0.11; }
    if (kind === "vagues") { f.type = "lowpass"; f.frequency.value = 500; g.gain.value = 0.0; const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.12; lfo.connect(lg).connect(g.gain); lfo.start(); nodes.push(lfo); }
    if (kind === "feu") {
      f.type = "lowpass"; f.frequency.value = 350; g.gain.value = 0.1;
      const crack = () => { if (!amb) return; const b = a.createBufferSource(), cg = a.createGain(), hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2000; b.buffer = noiseBuffer(a, 0.05); const t = a.currentTime; cg.gain.setValueAtTime(0.05 + Math.random() * 0.08, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); b.connect(hp).connect(cg).connect(master); b.start(); setTimeout(crack, 120 + Math.random() * 900); };
      setTimeout(crack, 300);
    }
    src.connect(f).connect(g).connect(master); src.start(); nodes.push(g); amb = nodes;
  }
  const ambChips = () => {
    const cur = store.get("amb", "silence");
    return `<div class="chips" id="amb">${[["silence", "🔇 Silence"], ["pluie", "🌧️ Pluie douce"], ["vagues", "🌊 Vagues"], ["feu", "🔥 Feu de bois"]].map(([k, l]) => `<button class="chip ${k === cur ? "on" : ""}" data-a="${k}">${l}</button>`).join("")}</div>
      <div class="row c hint">Volume <input class="vol" type="range" min="0" max="1" step="0.05" value="${store.get("vol", 0.6)}" id="vol"></div>`;
  };
  function bindAmb(root) {
    root.querySelectorAll("#amb .chip").forEach((b) => b.onclick = () => { root.querySelectorAll("#amb .chip").forEach((x) => x.classList.remove("on")); b.classList.add("on"); ambiance(b.dataset.a); if (b.dataset.a !== "silence") chime(); });
    const v = root.querySelector("#vol"); if (v) v.oninput = () => { store.set("vol", +v.value); if (master) master.gain.value = +v.value; };
  }

  /* ---------- Écran toujours allumé pendant la session ---------- */
  let lock = null;
  const wake = async (on) => { try { if (on && "wakeLock" in navigator) lock = await navigator.wakeLock.request("screen"); else if (!on && lock) { await lock.release(); lock = null; } } catch (e) {} };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && lock) wake(true); });

  /* ---------- Outils d'affichage ---------- */
  const PLUTARD = ["Plus tard… non ?", "T'as bien mérité une petite pause, non ?", "Juste une vidéo. Une seule.", "Il fait bon sur le canapé, tu sais…", "Et si tu rangeais ton bureau d'abord ?", "Tu ferais ça mieux demain, à tête reposée."];
  const VICTOIRE = ["Plutard est au chômage. Pour aujourd'hui.", "Round gagné. Plutard boude dans son plaid.", "Démarrage réussi : c'est exactement ce qui te manquait.", "Doudou est fier de toi. Plutard un peu moins."];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  const heure = (ts) => { const d = new Date(ts); return d.getHours() + " h " + String(d.getMinutes()).padStart(2, "0"); };
  const top = () => `<div class="top"><span>${esc(C.livre)} · ${C.id}</span><a href="../">Toutes les vidéos</a></div>`;
  let timer = null; const clearT = () => { if (timer) cancelAnimationFrame(timer); timer = null; };
  function screen(html, jour) { clearT(); document.body.classList.toggle("jour", !!jour); app.innerHTML = html; window.scrollTo(0, 0); return app; }

  /* ---------- Compte à rebours robuste (basé sur l'horloge, fonctionne écran en veille) ---------- */
  function countdown({ secondes, titre, message, cues = [], doudou = "doudou_bosse", suite, passer, tache = true }) {
    let fin = Date.now() + secondes * 1000, pause = null; const vus = new Set();
    const r = 46, L = 2 * Math.PI * r;
    const el = screen(`${top()}
      ${tache && S.tache ? `<div class="tache">🎯 <b>${esc(S.tache)}</b>${S.miette ? `<br><span class="hint">Première miette : ${esc(S.miette)}</span>` : ""}</div>` : ""}
      <div class="ringbox"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="#3a3644" stroke-width="7"/><circle id="arc" cx="50" cy="50" r="${r}" fill="none" stroke="#ffd23f" stroke-width="7" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="0"/></svg>
        <div class="t"><div class="mm" id="mm">${mmss(secondes)}</div><div class="hint">${esc(titre)}</div><div class="fin" id="fin">Fin à ${heure(fin)}</div></div></div>
      <div class="msg" id="msg">${esc(message || "")}</div>
      <div class="row c">
        <button class="btn sec" id="pause">⏸ Pause</button>
        ${tache ? `<button class="btn sec" id="park">🅿️ Garer une pensée <span class="badge" id="nb">${S.parking.length}</span></button>` : ""}
        ${passer ? `<button class="btn sec" id="skip">${passer} →</button>` : ""}
        <button class="btn sec" id="fs" title="Plein écran">⛶</button>
      </div>
      <img class="doudou-coin bob" src="${IMG}${doudou}.svg" alt="">`);
    const arc = el.querySelector("#arc"), mm = el.querySelector("#mm"), msg = el.querySelector("#msg");
    el.querySelector("#fs").onclick = () => { const d = document.documentElement; (document.fullscreenElement ? document.exitFullscreen() : d.requestFullscreen && d.requestFullscreen()).catch?.(() => {}); };
    el.querySelector("#pause").onclick = (e) => {
      if (pause === null) { pause = fin - Date.now(); e.target.textContent = "▶ Reprendre"; msg.textContent = "En pause. Plutard en profite pour s'étirer."; }
      else { fin = Date.now() + pause; pause = null; e.target.textContent = "⏸ Pause"; el.querySelector("#fin").textContent = "Fin à " + heure(fin); msg.textContent = "On reprend !"; }
    };
    if (passer) el.querySelector("#skip").onclick = () => { clearT(); suite(); };
    if (tache) el.querySelector("#park").onclick = parking;
    const tick = () => {
      const rest = pause !== null ? pause / 1000 : (fin - Date.now()) / 1000, ecoule = secondes - rest;
      mm.textContent = mmss(rest); arc.setAttribute("stroke-dashoffset", String(L * Math.min(1, ecoule / secondes)));
      cues.forEach((c, i) => { if (!vus.has(i) && ecoule >= c.at) { vus.add(i); chime(); if (c.plutard) plutard(c.texte); else msg.textContent = c.texte; } });
      if (rest <= 60 && secondes > 120 && !vus.has("last")) { vus.add("last"); msg.innerHTML = `<div class="alerte">Dernière minute : finis ta phrase, pas ton chapitre.</div>`; }
      if (rest <= 0) { chime(); return suite(); }
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  function plutard(texte) {
    const old = document.querySelector(".plutard-pop"); if (old) old.remove();
    const p = $(`<div class="plutard-pop"><img src="${IMG}plutard_tente.svg" alt="Plutard"><div class="bulle">« ${esc(pick(PLUTARD))} »<button class="btn" style="font-size:.9rem;padding:6px 12px">Non merci, Plutard !</button></div></div>`);
    document.body.appendChild(p);
    const m = document.getElementById("msg"); if (m) m.textContent = texte;
    p.querySelector("button").onclick = () => { p.remove(); const m2 = document.getElementById("msg"); if (m2) m2.textContent = "Bien joué. Retour à ta miette."; };
    setTimeout(() => p.remove(), 25000);
  }
  function parking() {
    const p = $(`<div class="parking"><b>🅿️ Le carnet de parking</b><p class="hint">Note la pensée parasite en 3 mots, et reviens à ta tâche. Tu t'en occuperas à la fin.</p>
      <div class="row"><input type="text" id="pk" placeholder="ex. appeler ma sœur" maxlength="80" style="flex:1"><button class="btn" id="ok">Garer</button></div>
      <ul id="pl">${S.parking.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><button class="btn sec" id="close">Fermer</button></div>`);
    document.body.appendChild(p); const i = p.querySelector("#pk"); i.focus();
    const add = () => { if (i.value.trim()) { S.parking.push(i.value.trim()); store.set("parking", S.parking); const nb = document.getElementById("nb"); if (nb) nb.textContent = S.parking.length; } p.remove(); };
    p.querySelector("#ok").onclick = add; i.onkeydown = (e) => { if (e.key === "Enter") add(); }; p.querySelector("#close").onclick = () => p.remove();
  }

  /* ---------- Les écrans ---------- */
  function accueil() {
    const total = (C.blocs || []).reduce((a, b) => a + b, 0) || (C.etapes || []).reduce((a, e) => a + e[0], 0);
    const el = screen(`${top()}<div class="grow center">
      <div class="duo"><img class="perso bob" src="${IMG}doudou_chrono.svg" alt="Doudou"></div>
      <h1>${esc(C.titre)}</h1>
      <p><b>${esc(C.consigne || (total ? `Session de ${total} minutes.` : ""))}</b><br>Doudou bosse avec toi jusqu'au bout.</p>
      <p class="hint">Choisis ton ambiance (tu pourras la changer pendant la session) :</p>${ambChips()}
      <div class="row c" style="margin-top:14px"><button class="btn" id="go">C'est parti →</button></div>
      <p class="hint" style="margin-top:18px"><a href="#" id="vid" style="color:inherit">Préférer la version vidéo simple</a></p></div>
      <footer>Gratuit, sans pub, sans inscription. Tes notes restent sur ton appareil.</footer>`, true);
    bindAmb(el);
    el.querySelector("#go").onclick = () => { audio(); ambiance(store.get("amb", "silence")); C.type === "etapes" ? etapes(0) : seuil(); };
    el.querySelector("#vid").onclick = (e) => { e.preventDefault(); video(); };
  }
  function seuil() {
    const prev = store.get("derniere", null);
    const el = screen(`${top()}<div class="grow">
      <h2>Le seuil : 2 minutes pour démarrer</h2>
      ${prev && prev.prochaine ? `<div class="check" id="reprendre" style="background:#fff">↩️ Reprendre là où tu t'étais arrêté : <b>${esc(prev.prochaine)}</b></div>` : ""}
      <label class="f" for="t">1. Ta tâche, avec un verbe</label><input type="text" id="t" maxlength="120" placeholder="ex. Trier la pile de courrier de l'entrée" value="${esc(store.get("tache", ""))}">
      <label class="f" for="m">2. Ta première miette (moins de 2 minutes)</label><input type="text" id="m" maxlength="120" placeholder="ex. Prendre la feuille du dessus">
      <label class="f">3. Les trois cadenas</label>
      <label class="check"><input type="checkbox" id="c1"> 📵 Mon téléphone est loin de moi</label>
      <label class="check"><input type="checkbox" id="c2"> 💧 Mon poste est prêt (eau, matériel)</label>
      <label class="check"><input type="checkbox" id="c3"> 🏁 J'ai le droit de m'arrêter au « ding » final</label>
      <div class="row" style="margin-top:14px"><button class="btn" id="go" disabled>Lancer la session</button><span class="hint" id="why">Écris ta tâche et éloigne ton téléphone.</span></div>
      <img class="doudou-coin bob" src="${IMG}doudou_bosse.svg" alt=""></div>`, true);
    const t = el.querySelector("#t"), m = el.querySelector("#m"), go = el.querySelector("#go"), c1 = el.querySelector("#c1");
    const r = el.querySelector("#reprendre"); if (r) r.onclick = () => { m.value = prev.prochaine; if (!t.value) t.value = prev.tache || ""; check(); };
    const check = () => { const ok = t.value.trim().length > 2 && c1.checked; go.disabled = !ok; el.querySelector("#why").textContent = ok ? "Doudou est prêt." : "Écris ta tâche et éloigne ton téléphone."; };
    [t, m, c1].forEach((x) => x.oninput = x.onchange = check); check();
    go.onclick = () => { S.tache = t.value.trim(); S.miette = m.value.trim(); S.debut = Date.now(); S.parking = []; store.set("tache", S.tache); store.set("parking", []); wake(true); bloc(0); };
  }
  function bloc(i) {
    const n = C.blocs.length, m = C.blocs[i];
    const cues = [];
    if (C.cloche_toutes_min) for (let k = C.cloche_toutes_min; k < m; k += C.cloche_toutes_min) cues.push({ at: k * 60, texte: C.message_cloche });
    else (C.reperes_min || [m / 2]).forEach((k) => { if (k < m) cues.push({ at: k * 60, texte: k === m / 2 ? "Mi-parcours ! Plutard tente une sortie… Reviens à ta miette." : "Plutard rôde. Reviens à ta miette.", plutard: true }); });
    chime();
    countdown({ secondes: m * 60, titre: n > 1 ? `Manche ${i + 1}/${n}` : C.titre, message: "C'est parti. Doudou bosse à côté de toi.", cues,
      doudou: C.pose === "debout" ? "doudou_chrono" : "doudou_bosse", suite: () => (i < n - 1 ? pauseEntre(i) : cloture()) });
  }
  function pauseEntre(i) {
    countdown({ secondes: 300, titre: "Pause", message: "Lève-toi. Bois. Ne touche à aucun écran. Au « ding », on reprend.", tache: false, doudou: "doudou_bravo", passer: "Je reprends", suite: () => bloc(i + 1) });
  }
  function etapes(i) {
    const e = C.etapes; if (i >= e.length) return finEtapes();
    if (i === 0) wake(true);
    chime();
    countdown({ secondes: e[i][0] * 60, titre: `Étape ${i + 1}/${e.length}`, message: e[i][1], tache: false, passer: "Étape suivante", doudou: i === e.length - 1 ? "doudou_chrono" : "doudou_bosse", suite: () => etapes(i + 1) });
  }
  function finEtapes() { wake(false); const [t, ...r] = C.fin.split("\n"); victoire(t, r.join(" "), false); }
  function cloture() {
    wake(false); ambiance("silence");
    const el = screen(`${top()}<div class="grow"><h2>La clôture : 3 questions, 3 minutes</h2>
      ${S.parking.length ? `<div class="check" style="display:block">🅿️ Ton parking : ${S.parking.map(esc).join(" · ")}</div>` : ""}
      <label class="f" for="q1">Qu'est-ce que tu as fait ?</label><textarea id="q1" placeholder="Une ligne, factuelle."></textarea>
      <label class="f" for="q2">Où tu en es, exactement ?</label><textarea id="q2" placeholder="Une ligne, précise."></textarea>
      <label class="f" for="q3">C'est quoi, ta prochaine miette ?</label><textarea id="q3" placeholder="La toute première action de la prochaine fois."></textarea>
      <div class="row" style="margin-top:14px"><button class="btn" id="ok">Valider ma victoire 🏆</button></div>
      <img class="doudou-coin bob" src="${IMG}doudou_chrono.svg" alt=""></div>`, true);
    el.querySelector("#ok").onclick = () => {
      S.cloture = { fait: el.querySelector("#q1").value.trim(), ou: el.querySelector("#q2").value.trim(), prochaine: el.querySelector("#q3").value.trim() };
      const h = store.get("historique", []); h.unshift({ date: new Date().toISOString(), video: C.id, tache: S.tache, ...S.cloture, parking: S.parking }); store.set("historique", h.slice(0, 50));
      store.set("derniere", { tache: S.tache, prochaine: S.cloture.prochaine });
      victoire("Victoire !", pick(VICTOIRE), true);
    };
  }
  function victoire(titre, texte, compte) {
    let n = store.get("rounds", 0); if (compte) { n += 1; store.set("rounds", n); }
    const h = store.get("historique", []);
    const el = screen(`${top()}<div class="grow center">
      <div class="duo"><img class="perso wiggle" src="${IMG}plutard_boude.svg" alt="Plutard qui boude"><img class="perso bob pop" src="${IMG}doudou_bravo.svg" alt="Doudou qui fête"></div>
      <h1>${esc(titre)}</h1><p><b>${esc(texte)}</b></p>
      ${n ? `<p style="font-size:1.3rem">🏆 Rounds gagnés contre Plutard : <b>${n}</b></p>` : ""}
      ${compte ? `<div class="row c"><button class="btn" id="dl">📄 Télécharger ma fiche</button><a class="btn sec" href="./">Une autre session</a><a class="btn sec" href="../">Toutes les vidéos</a></div>` : `<div class="row c"><a class="btn" href="../">Toutes les vidéos</a></div>`}
      ${h.length > 1 ? `<details style="margin-top:18px"><summary>Mes dernières sessions</summary><ul class="histo">${h.slice(0, 7).map((x) => `<li>${new Date(x.date).toLocaleDateString("fr-FR")} · ${esc(x.video)} · ${esc(x.tache)}</li>`).join("")}</ul></details>` : ""}
      </div><canvas id="confetti"></canvas>`, true);
    confetti(el.querySelector("#confetti")); chime();
    const dl = el.querySelector("#dl");
    if (dl) dl.onclick = () => {
      const d = new Date(), txt = `FICHE DE SESSION — ${C.livre}\n${d.toLocaleString("fr-FR")} · ${C.id} ${C.titre}\n\nMa tâche : ${S.tache}\nPremière miette : ${S.miette}\n\nCe que j'ai fait : ${S.cloture.fait}\nOù j'en suis : ${S.cloture.ou}\nProchaine miette : ${S.cloture.prochaine}\n\nPensées garées : ${S.parking.join(" ; ") || "aucune"}\n\nRounds gagnés contre Plutard : ${n}\n`;
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" })); a.download = `fiche-session-${d.toISOString().slice(0, 10)}.txt`; a.click();
    };
  }
  function confetti(cv) {
    const c = cv.getContext("2d"); cv.width = innerWidth; cv.height = innerHeight;
    const cols = ["#ff5a4e", "#ffd23f", "#2ec4b6", "#8f6cf0", "#ffffff"];
    const P = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.6, r: 5 + Math.random() * 7, vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, a: Math.random() * 6, va: -0.2 + Math.random() * 0.4, col: cols[Math.floor(Math.random() * cols.length)] }));
    let f = 0; const step = () => { c.clearRect(0, 0, cv.width, cv.height); P.forEach((p) => { p.y += p.vy; p.x += p.vx; p.a += p.va; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); }); if (++f < 260) requestAnimationFrame(step); else c.clearRect(0, 0, cv.width, cv.height); };
    step();
  }
  function cartes(i) {
    const k = C.cartes, [t, s, img] = k[i];
    const el = screen(`${top()}<div class="grow center">
      ${img ? `<div class="duo"><img class="perso bob pop" src="${IMG}${img}.svg" alt=""></div>` : ""}
      <h1 class="pop">${esc(t)}</h1><p style="font-size:1.2rem;white-space:pre-line"><b>${esc(s)}</b></p>
      <div class="dots">${k.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</div>
      <div class="row c">${i > 0 ? `<button class="btn sec" id="prev">←</button>` : ""}<button class="btn" id="next">${i < k.length - 1 ? "Suivant →" : C.id === "V00" ? "Ma première session →" : "Toutes les vidéos"}</button></div>
      <p class="hint" style="margin-top:16px"><a href="#" id="vid" style="color:inherit">Version vidéo</a></p></div>`, true);
    el.querySelector("#next").onclick = () => { audio(); if (i < k.length - 1) cartes(i + 1); else location.href = C.id === "V00" ? "../v01/" : "../"; };
    const p = el.querySelector("#prev"); if (p) p.onclick = () => cartes(i - 1);
    el.querySelector("#vid").onclick = (e) => { e.preventDefault(); video(); };
  }
  function video() {
    ambiance("silence");
    screen(`${top()}<h2>${esc(C.id)} · ${esc(C.titre)} — version vidéo</h2>
      <video controls playsinline preload="metadata" src="${C.mp4}"><track kind="subtitles" srclang="fr" label="Français" src="sous-titres.vtt" default></video>
      <p class="hint">Avant de lancer : ta tâche écrite avec un verbe, ton téléphone loin de toi. Mets la vidéo en plein écran.</p>
      <div class="row"><a class="btn" href="./">← Revenir à la session interactive</a></div>`, false);
  }

  C.type === "cartes" ? cartes(0) : accueil();
})();
