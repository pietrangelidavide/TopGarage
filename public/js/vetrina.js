/* AutoProfit · sito pubblico del garage: vetrina, orari, scheda dell'auto. La prenotazione sta in prenota.js.
   Tutto ciò che cambia da garage a garage (nome, orari, colori, moduli) arriva da garage.json tramite ap-config.js. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const V = AP.Visite;
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let DISP = [], CFG = null;
  const stato = { marca: "", alim: "", ord: "recenti" };

  /* ---------- aperto o chiuso adesso ---------- */
  function statoOggi() {
    const n = V.adesso(CFG.fuso), f = V.fasce(CFG, n.data), corr = f.find((x) => n.min >= x[0] && n.min < x[1]);
    if (corr) return { aperto: true, testo: "Aperto ora, fino alle " + V.hhmm(corr[1]) };
    const dopo = f.find((x) => x[0] > n.min);
    if (dopo) return { aperto: false, testo: "Chiuso ora, riapre alle " + V.hhmm(dopo[0]) };
    for (let i = 1; i <= 14; i++) { const d = V.piu(n.data, i), ff = V.fasce(CFG, d); if (ff.length) return { aperto: false, testo: "Chiuso, riapre " + (i === 1 ? "domani" : GIORNI[V.giornoSett(d)]) + " alle " + V.hhmm(ff[0][0]) }; }
    return { aperto: false, testo: "Chiuso" };
  }
  function disegnaOrari() {
    const oggi = V.giornoSett(V.adesso(CFG.fuso).data), o = CFG.orari || {};
    $("#orari").innerHTML = [1, 2, 3, 4, 5, 6, 0].map((g) => {
      const f = (o[g] || []).filter((x) => x && x[0] && x[1]);
      return `<tr class="${g === oggi ? "oggi" : ""}"${g === oggi ? ' aria-current="date"' : ""}><th scope="row">${GIORNI[g].replace(/^./, (c) => c.toUpperCase())}</th>${f.length ? `<td>${f.map((x) => esc(x[0]) + " – " + esc(x[1])).join(" · ")}</td>` : '<td class="ch">Chiuso</td>'}</tr>`;
    }).join("");
    const n = V.adesso(CFG.fuso).data, ch = ((CFG.visite || {}).chiusure || []).filter((d) => V.dataValida(d) && d >= n && V.giorniTra(n, d) <= 120).sort();
    const el = $("#orari-n");
    if (ch.length) { el.hidden = false; el.textContent = "Chiusi anche: " + ch.map((d) => +d.slice(8, 10) + " " + MESI[+d.slice(5, 7) - 1]).join(", ") + "."; }
  }
  function disegnaContatti() {
    const c = CFG.contatti || {}, b = $("#dove-btn"), mappa = c.mappa || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([c.indirizzo, c.citta].filter(Boolean).join(" "));
    const wa = String(c.whatsapp || "").replace(/\D/g, "");
    const altri = (Array.isArray(c.link) ? c.link : []).filter((l) => l && /^https:\/\/[^\s]+$/i.test(String(l.url || "")) && l.etichetta).slice(0, 4);   // profili e pagine del garage (Instagram, AutoScout24, …)
    b.innerHTML = (c.indirizzo ? `<a class="btn btn-line" href="${esc(mappa)}" target="_blank" rel="noopener">Indicazioni stradali</a>` : "") + (wa ? `<a class="btn btn-line" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : "")
      + altri.map((l) => `<a class="btn btn-line" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.etichetta)}</a>`).join("");
    $("#r-mail").hidden = !c.email;
  }

  /* ---------- auto ---------- */
  const art = (a) => { const f = TG.fotoLista(a.foto, "")[0]; return f ? `<img src="${esc(f)}" alt="${esc(TG.titolo(a) + " " + a.allestimento)}" loading="lazy" decoding="async">` : TG.carArt(a); };
  const specs = (a) => [a.anno, a.km != null ? TG.km(a.km) : "", a.alimentazione, a.cambio].filter(Boolean).map((s) => `<li>${esc(s)}</li>`).join("");
  function ordina(l, ord) {
    const nz = (v, d) => (v == null ? d : v);
    return l.slice().sort({
      recenti: (a, b) => nz(b.anno, 0) - nz(a.anno, 0) || nz(a.km, 1e9) - nz(b.km, 1e9),
      "prezzo-asc": (a, b) => nz(a.prezzo, 1e12) - nz(b.prezzo, 1e12),
      "prezzo-desc": (a, b) => nz(b.prezzo, -1) - nz(a.prezzo, -1),
      "km-asc": (a, b) => nz(a.km, 1e9) - nz(b.km, 1e9),
    }[ord]);
  }
  function card(a) {
    return `<article class="car"><div class="stage">${art(a)}${a.demo ? '<span class="tag-demo">Esempio</span>' : ""}</div>
  <div class="car-body"><div><h3>${esc(TG.titolo(a))}</h3>${a.allestimento ? `<p class="trim">${esc(a.allestimento)}</p>` : ""}</div>
  <ul class="specs">${specs(a)}</ul>
  <div class="buy"><span class="price">${TG.euroHtml(a.prezzo)}</span><span class="more">Dettagli</span></div></div>
  <button type="button" class="car-hit" data-id="${esc(a.id)}" aria-label="Dettagli: ${esc(TG.titolo(a))} ${esc(a.allestimento)}"></button></article>`;
  }
  function griglia() {
    const l = ordina(DISP.filter((a) => (!stato.marca || a.marca === stato.marca) && (!stato.alim || a.alimentazione === stato.alim)), stato.ord);
    $("#griglia").innerHTML = l.map(card).join("");
    $("#vuoto").hidden = l.length > 0;
    $("#conteggio").textContent = !DISP.length ? "" : l.length === DISP.length ? DISP.length + " auto" : l.length + " di " + DISP.length + " auto";
  }
  function filtri() {
    if (!DISP.length) { $("#vuoto").hidden = false; $("#vuoto").textContent = "Stiamo preparando la vetrina: passa presto o chiamaci per sapere cosa abbiamo."; return; }
    const marche = [...new Set(DISP.map((a) => a.marca).filter(Boolean))].sort((x, y) => x.localeCompare(y, "it"));
    const chips = $("#chips");
    chips.innerHTML = ["", ...marche].map((m) => `<button type="button" class="chip" data-m="${esc(m)}" aria-pressed="${m === ""}">${m || "Tutte"}</button>`).join("");
    chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; stato.marca = b.dataset.m; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b))); griglia(); });
    const alim = [...new Set(DISP.map((a) => a.alimentazione).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
    $("#f-alim").insertAdjacentHTML("beforeend", alim.map((x) => `<option>${esc(x)}</option>`).join(""));
    $("#f-alim").onchange = (e) => ((stato.alim = e.target.value), griglia());
    $("#f-ord").onchange = (e) => ((stato.ord = e.target.value), griglia());
    $("#filtri").hidden = false;
  }

  /* ---------- scheda ---------- */
  const dlg = $("#scheda");
  let ultimo = null;
  function galleria(a) {
    const fs = TG.fotoLista(a.foto, "");
    if (!fs.length) return `<div class="sheet-media">${TG.carArt(a)}</div>`;
    const alt = esc(TG.titolo(a) + " " + a.allestimento);
    return `<div class="sheet-media gal"><img class="gal-main" src="${esc(fs[0])}" alt="${alt}" decoding="async">${fs.length > 1 ? `<div class="gal-thumbs" role="group" aria-label="Altre foto">${fs.map((f, i) => `<button type="button" class="gal-t" aria-pressed="${i === 0}" aria-label="Foto ${i + 1} di ${fs.length}" data-src="${esc(f)}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}</div>`;
  }
  function apriScheda(id) {
    const a = DISP.find((x) => x.id === id); if (!a) return;
    ultimo = document.activeElement;
    const c = CFG.contatti || {}, wa = String(c.whatsapp || "").replace(/\D/g, ""), tit = TG.titolo(a);
    const righe = [["Anno", a.anno], ["Chilometri", a.km != null ? TG.km(a.km) : ""], ["Alimentazione", a.alimentazione], ["Cambio", a.cambio], ["Potenza", a.cv ? a.cv + " CV" : ""], ["Colore", a.colore], ["Carrozzeria", a.carrozzeria]]
      .filter((r) => r[1]).map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("");
    const msg = `Buongiorno, vorrei informazioni su ${tit}${a.allestimento ? " " + a.allestimento : ""}${a.anno ? " del " + a.anno : ""}.`;
    dlg.innerHTML = `<div class="sheet"><button type="button" class="close" aria-label="Chiudi la scheda"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
  ${galleria(a)}
  <div class="sheet-info"><div><h2 id="scheda-titolo">${esc(tit)}</h2>${a.allestimento ? `<p class="trim">${esc(a.allestimento)}</p>` : ""}</div>
    <p class="sheet-price">${TG.euroHtml(a.prezzo)}</p><dl>${righe}</dl>${a.descrizione ? `<p class="sheet-text">${esc(a.descrizione)}</p>` : ""}
    <div class="sheet-actions">
      ${AP.Prenota && AP.Prenota.attiva() ? `<button type="button" class="btn btn-acc" data-prenota="${esc(a.id)}">Prenota una visita</button>` : ""}
      ${c.telefono ? `<a class="btn btn-line" href="tel:${esc(String(c.telefono).replace(/[^+\d]/g, ""))}">Chiama ${esc(c.telefono)}</a>` : ""}
      ${wa ? `<a class="btn btn-line" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${a.autoscout_url ? `<a class="lnk" href="${esc(a.autoscout_url)}" target="_blank" rel="noopener">Vedi anche su AutoScout24</a>` : ""}
    </div></div></div>`;
    dlg.showModal(); document.documentElement.style.overflow = "hidden";
  }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest(".close")) return dlg.close();
    const p = e.target.closest("[data-prenota]");
    if (p) { dlg.close(); AP.Prenota.scegliAuto(p.dataset.prenota); return; }
    const t = e.target.closest(".gal-t");
    if (t) { dlg.querySelector(".gal-main").src = t.dataset.src; dlg.querySelectorAll(".gal-t").forEach((x) => x.setAttribute("aria-pressed", String(x === t))); }
  });
  dlg.addEventListener("close", () => { document.documentElement.style.overflow = ""; if (ultimo && ultimo.focus) ultimo.focus({ preventScroll: true }); });
  $("#griglia").addEventListener("click", (e) => { const b = e.target.closest(".car-hit"); if (b) apriScheda(b.dataset.id); });

  /* ---------- menu a tendina ---------- */
  function menu() {
    const m = $("#menu"), btn = $("#menu-btn"), pan = $("#menu-lista");
    const apri = (v) => { btn.setAttribute("aria-expanded", String(v)); pan.hidden = !v; };
    btn.addEventListener("click", () => apri(pan.hidden));
    document.addEventListener("click", (e) => { if (!pan.hidden && !m.contains(e.target)) apri(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pan.hidden) { apri(false); btn.focus(); } });
    pan.addEventListener("click", (e) => { if (e.target.closest("a")) apri(false); });
    m.addEventListener("focusout", (e) => { if (!pan.hidden && e.relatedTarget && !m.contains(e.relatedTarget)) apri(false); });
  }
  /* la voce del menu della sezione che stai guardando */
  function segnaSezione() {
    if (!("IntersectionObserver" in window)) return;
    const voci = {};
    document.querySelectorAll("#menu-lista > ul > li > a").forEach((a) => (voci[a.getAttribute("href").slice(1)] = a));
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting) return;
      Object.values(voci).forEach((a) => a.removeAttribute("aria-current"));
      const a = voci[en.target.id]; if (a) a.setAttribute("aria-current", "true");
    }), { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(voci).forEach((id) => { const el = document.getElementById(id); if (el && !el.hidden) io.observe(el); });
  }

  /* ---------- chi siamo: testo, social, recensioni ---------- */
  const igUrl = (u) => { try { const x = new URL(String(u || "")); return x.protocol === "https:" && /(^|\.)instagram\.com$/.test(x.hostname) ? x.origin + x.pathname : ""; } catch (e) { return ""; } };   // senza i codici di tracciamento dopo il «?»
  const https = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u) : "");
  const imgOk = (u) => { u = String(u || "").trim(); return https(u) || (/^[\w./-]+\.(jpe?g|png|webp|avif|svg)$/i.test(u) && !u.includes("..") && u[0] !== "/" ? u : ""); };
  const lnk = (re) => { const l = ((CFG.contatti || {}).link || []).find((x) => x && re.test(x.etichetta || "") && https(x.url)); return l ? l.url : ""; };
  const stelleHtml = (v, piccole) => `<span class="stelle${piccole ? " p" : ""}" style="--p:${Math.max(0, Math.min(100, (+v || 0) * 20)).toFixed(1)}%" role="img" aria-label="${(+v || 0).toLocaleString("it-IT", { maximumFractionDigits: 1 })} stelle su 5"></span>`;

  function disegnaIg() {
    const ig = (CFG.social || {}).instagram; if (!ig) return false;
    let url = igUrl(ig.url) || (ig.handle ? igUrl("https://www.instagram.com/" + String(ig.handle).replace(/^@/, "").replace(/[^\w.]/g, "") + "/") : "");
    if (!url) return false;
    const handle = ig.handle ? String(ig.handle).replace(/^@/, "") : new URL(url).pathname.replace(/\//g, "");
    const t = CFG.tema || {}, av = imgOk(ig.avatar) || imgOk(t.logoSuScuro) || imgOk(t.logo);
    const nome = ig.nome || CFG.nome;
    const num = [["post", ig.post], ["follower", ig.follower], ["seguiti", ig.seguiti]].filter((x) => x[1] != null && x[1] !== "" && isFinite(+x[1])).map((x) => `<div><b>${esc(TG.num(+x[1]))}</b><span>${x[0]}</span></div>`).join("");
    const imm = (Array.isArray(ig.immagini) ? ig.immagini : []).map(imgOk).filter(Boolean).slice(0, 9);
    let tessere = imm.map((u, i) => `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="Apri il profilo Instagram di ${esc(nome)}"><img src="${esc(u)}" alt="Foto dal profilo Instagram, numero ${i + 1}" loading="lazy" decoding="async"></a>`);
    if (!tessere.length) tessere = DISP.slice(0, Math.min(9, Math.floor(DISP.length / 3) * 3)).map((a) => `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="Apri il profilo Instagram di ${esc(nome)}">${art(a)}</a>`);
    const el = $("#social");
    el.innerHTML = `<h3 id="t-ig">Su Instagram</h3>
      <div class="ig-testa"><div class="ig-foto">${av ? `<img src="${esc(av)}" alt="">` : `<span aria-hidden="true">${esc(nome.charAt(0))}</span>`}</div>
        <div><p class="ig-nome">${esc(nome)}</p><p class="ig-sotto">@${esc(handle)}</p>${num ? `<div class="ig-num">${num}</div>` : ""}</div></div>
      ${ig.bio ? `<p class="ig-bio">${esc(ig.bio)}</p>` : ""}
      ${tessere.length ? `<div class="ig-griglia">${tessere.join("")}</div>` : ""}
      <p class="ig-nota">${imm.length ? "Alcune foto dal profilo. Le novità sono su Instagram." : "Le foto più recenti, le storie e i video sono sul profilo Instagram."}</p>
      <div class="ig-azioni"><a class="btn btn-ink" href="${esc(url)}" target="_blank" rel="noopener">Segui @${esc(handle)}</a></div>`;
    el.hidden = false; return true;
  }

  async function caricaRecensioni() {
    if (CFG.moduli && CFG.moduli.recensioni === false) return null;
    const prova = async (u) => { try { const r = await fetch(u, { headers: { accept: "application/json" }, cache: "no-cache" }); if (!r.ok) return null; const j = await r.json(); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch (e) { return null; } };
    let j = null;
    if (CFG.demo) return CFG.recensioniEsempio && typeof CFG.recensioniEsempio === "object" ? CFG.recensioniEsempio : null;       // anteprima: dati d’esempio dichiarati, nessuna richiesta
    if (!CFG.demo) { j = await prova("api/recensioni"); if (j && j.attivo === false) j = null; }          // senza Place ID e chiave il Worker risponde «attivo: false»
    if (!j) j = await prova("data/recensioni.json");
    return j;
  }
  function disegnaRec(j) {
    if (CFG.moduli && CFG.moduli.recensioni === false) return false;
    const el = $("#recensioni"), voto = j && +j.voto > 0 && +j.voto <= 5 ? +j.voto : 0, totale = j && +j.totale > 0 ? Math.round(+j.totale) : 0;
    const lista = ((j && Array.isArray(j.recensioni)) ? j.recensioni : []).filter((r) => r && String(r.testo || "").trim()).slice(0, 6);
    const tutte = https(j && j.tutte) || lnk(/google/i), scrivi = https(j && j.scrivi), esempio = !!(j && j.demo);
    if (!voto && !lista.length && !tutte) return false;
    const agg = j && j.fonte === "google" && j.aggiornato ? new Date(j.aggiornato) : null;
    const testa = voto ? `<div class="rec-testa"><span class="rec-voto">${voto.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
        <div class="rec-meta">${stelleHtml(voto)}<span>${totale ? `su ${esc(TG.num(totale))} ${totale === 1 ? "recensione" : "recensioni"} su Google` : "media delle recensioni su Google"}</span>${esempio ? '<span class="tag-ese">Esempio: dati non reali</span>' : ""}</div></div>`
      : '<p>Leggi cosa dicono di noi i clienti su Google.</p>';
    const cards = lista.map((r) => `<li class="rec-i">${stelleHtml(Math.max(1, Math.min(5, Math.round(+r.stelle || 0))), true)}<blockquote>${esc(r.testo)}</blockquote>
        <footer><b>${esc(String(r.autore || "Cliente").slice(0, 60))}</b>${r.quando ? `<span>${esc(String(r.quando).slice(0, 40))}</span>` : ""}${r.demo || esempio ? '<span class="tag-ese">Esempio</span>' : ""}</footer></li>`).join("");
    el.innerHTML = `<h3 id="t-rec">Cosa dicono di noi</h3>${testa}
      ${cards ? `<ul class="rec-lista" tabindex="0" aria-label="Recensioni dei clienti">${cards}</ul>` : ""}
      <div class="rec-azioni">${tutte ? `<a class="btn btn-ink" href="${esc(tutte)}" target="_blank" rel="noopener">Leggi tutte su Google</a>` : ""}${scrivi ? `<a class="btn btn-line" href="${esc(scrivi)}" target="_blank" rel="noopener">Scrivi una recensione</a>` : ""}</div>
      ${esempio ? '<p class="rec-fonte">Voto, numero e recensioni di questo riquadro sono d’esempio: nel sito vero compaiono quelli della scheda Google.</p>' : j && j.fonte === "google" ? `<p class="rec-fonte">Fonte: Google${agg && !isNaN(agg) ? ", aggiornato il " + agg.getDate() + " " + MESI[agg.getMonth()] : ""}.</p>` : ""}`;
    el.hidden = false; return true;
  }
  async function chiSiamo() {
    const ch = CFG.chiSiamo || {}, testo = [].concat(ch.testo || []).map((x) => String(x).trim()).filter(Boolean), punti = (Array.isArray(ch.punti) ? ch.punti : []).filter((x) => x && x.titolo);
    const rec = await caricaRecensioni();
    const okIg = disegnaIg(), okRec = disegnaRec(rec);
    if (ch.titolo) $("#t-chi").textContent = String(ch.titolo);
    $("#chi-testo").innerHTML = testo.map((p) => `<p>${esc(p)}</p>`).join("");
    $("#chi-punti").innerHTML = punti.slice(0, 6).map((x) => `<li><b>${esc(x.titolo)}</b>${x.testo ? `<span>${esc(x.testo)}</span>` : ""}</li>`).join("");
    if (!testo.length && !punti.length) $(".chi-g").hidden = true;
    const altri = (((CFG.contatti || {}).link) || []).filter((l) => l && https(l.url) && l.etichetta).slice(0, 4);
    $("#chi-link").innerHTML = altri.map((l) => `<a class="btn btn-line" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.etichetta)}</a>`).join("");
    $("#chi-link").hidden = !(testo.length || punti.length) || !altri.length;
    $(".soc-g").hidden = !okIg && !okRec;
    $(".soc-g").style.gridTemplateColumns = okIg && okRec ? "" : "minmax(0,1fr)";
    const visibile = testo.length || punti.length || okIg || okRec;
    $("#chi-siamo").hidden = !visibile;
    const voce = $("#menu-lista [data-chi]"); voce.hidden = !visibile;
    $("#menu-lista [data-sub=social]").hidden = !okIg; $("#menu-lista [data-sub=recensioni]").hidden = !okRec;
    voce.querySelector(".menu-sub").hidden = !(okIg || okRec);
  }

  /* ---------- avvio ---------- */
  AP.pronto.then(async (cfg) => {
    CFG = cfg;
    const s = statoOggi(), el = $("#stato-oggi"); el.textContent = s.testo; el.classList.toggle("aperto", s.aperto);
    disegnaOrari(); disegnaContatti();
    const ti = cfg.testi || {}; if (ti.autoIntro != null) $("#auto-intro").textContent = String(ti.autoIntro);   // le promesse sulle auto (controlli, garanzia, prezzo) le decide il garage
    if (cfg.demo) {
      const b = document.createElement("div"); b.className = "demo-banda";
      b.innerHTML = 'Sito di dimostrazione: auto, prezzi e orari sono d’esempio.' + (cfg.demoGestionale ? ' <a href="' + esc(cfg.demoGestionale) + '">Apri il gestionale del garage</a>' : "");
      document.body.insertBefore(b, document.body.firstChild);
    }
    menu();
    Object.keys(cfg.moduli || {}).forEach((k) => { if (cfg.moduli[k] === false) document.querySelectorAll("[data-modulo=" + k + "]").forEach((e) => (e.hidden = true)); });
    if (cfg.moduli && cfg.moduli.vetrina === false) $("#auto").hidden = true;
    try { const j = await TG.carica("data/auto.json"); DISP = j.auto.filter((a) => a.stato === "disponibile"); } catch (e) { DISP = []; }
    filtri(); griglia();
    await Promise.all([AP.Prenota.init(cfg, DISP), AP.Vendi.init(cfg)]);
    await chiSiamo();
    segnaSezione();
  });
})();
