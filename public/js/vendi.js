/* AutoProfit · «Vendi la tua auto» (lato cliente): modulo con i dati dell'auto e almeno 4 foto.
   Le regole (campi obbligatori, numero di foto) sono quelle di js/richieste-core.js, le stesse che il Worker ricontrolla (src/richieste.js).
   Le foto vengono ridotte nel telefono (lato lungo 1800 px, JPEG, sotto 700 KB) prima di partire: una foto da 8 MB diventa ~400 KB.
   Due modi:
     - normale: la richiesta viaggia al Worker (POST api/vendi, multipart) e arriva nel gestionale, scheda «Valutazioni»
     - demo (garage.json → demo:true): nessun server; la richiesta resta in questo browser (localStorage «autoprofit.richieste.coda»,
       foto in miniatura in «autoprofit.richieste.foto») e il gestionale della demo la ritrova. */
(function () {
  "use strict";
  const AP = (window.AP = window.AP || {});
  const R = AP.Richieste;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const CODA = "autoprofit.richieste.coda", FOTO = "autoprofit.richieste.foto";
  const SUGGERITE = ["davanti", "dietro", "interni", "cruscotto e km"];
  const leggi = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  const S = { cfg: null, locale: false, lim: { min: R.FOTO_MIN, max: R.FOTO_MAX, byte: R.FOTO_BYTE }, F: [], seq: 0, avviso: "", inviando: false };

  /* ---------- foto: lettura e riduzione ---------- */
  async function decodifica(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* si prova con un'immagine normale */ } }
    return new Promise((ok, ko) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); ok(im); };
      im.onerror = () => { URL.revokeObjectURL(u); ko(new Error("illeggibile")); };
      im.src = u;
    });
  }
  const paraBlob = (c, q) => new Promise((r) => c.toBlob(r, "image/jpeg", q));
  async function riduci(file) {
    let img;
    try { img = await decodifica(file); } catch (e) { throw new Error("Non riesco a leggere «" + file.name + "»: prova con una foto JPEG o PNG."); }
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    if (Math.max(w0, h0) < 480) { if (img.close) img.close(); throw new Error("La foto «" + file.name + "» è troppo piccola: serve almeno 480 pixel sul lato lungo."); }
    const tetto = S.lim.byte - 1024;
    let lato = Math.min(1800, Math.max(w0, h0)), q = 0.86;
    try {
      for (let giro = 0; giro < 9; giro++) {
        const k = lato / Math.max(w0, h0), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
        const blob = await paraBlob(c, q);
        if (!blob) throw new Error("Non riesco a preparare «" + file.name + "».");
        if (blob.size <= tetto) return blob;
        if (q > 0.6) q -= 0.1; else { lato = Math.round(lato * 0.8); q = 0.8; }
      }
    } finally { if (img.close) img.close(); }
    throw new Error("La foto «" + file.name + "» è troppo pesante anche dopo averla ridotta: provane un’altra.");
  }
  async function miniatura(blob) {                                  // solo per la demo: ~20 KB a foto, così stanno in localStorage
    const img = await decodifica(blob), w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height, k = 360 / Math.max(w0, h0, 360);
    const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); if (img.close) img.close();
    return c.toDataURL("image/jpeg", 0.6);
  }

  /* ---------- foto: elenco a video ---------- */
  const X = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>';
  function disegna() {
    const pronte = S.F.filter((f) => !f.lavoro).length;
    let h = S.F.map((f, i) => f.lavoro
      ? '<div class="ve-t lavoro" role="listitem">Preparo la foto…</div>'
      : `<div class="ve-t" role="listitem"><img src="${f.url}" alt="Foto ${i + 1} aggiunta"><span class="num">${i + 1}</span><button type="button" class="tolgo" data-i="${i}" aria-label="Togli la foto ${i + 1}">${X}</button></div>`).join("");
    for (let i = S.F.length; i < S.lim.min; i++) h += `<div class="ve-t vuota" role="listitem"><b>Foto ${i + 1}</b><span>${SUGGERITE[i] || "a scelta"}</span></div>`;
    $("#ve-tessere").innerHTML = h;
    const st = $("#ve-stato");
    const base = pronte >= S.lim.min ? `${pronte} foto aggiunte${pronte >= S.lim.max ? ": è il massimo." : ". Bastano, ma puoi aggiungerne fino a " + S.lim.max + "."}` : `${pronte} foto su ${S.lim.min}: ne ${S.lim.min - pronte === 1 ? "manca ancora una" : "mancano ancora " + (S.lim.min - pronte)}.`;
    st.textContent = base + (S.avviso ? " " + S.avviso : "");
    st.className = "ve-stato" + (pronte >= S.lim.min ? " ok" : "");
    $("#ve-aggiungi").disabled = S.F.length >= S.lim.max;
  }
  async function aggiungi(files) {
    S.avviso = "";
    const tutte = [...files], buone = tutte.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name));
    if (buone.length < tutte.length) S.avviso = "Qualche file non era una foto ed è stato ignorato.";
    for (const file of buone) {
      if (S.F.length >= S.lim.max) { S.avviso = `Al massimo ${S.lim.max} foto: le altre non sono state aggiunte.`; break; }
      const chiave = file.name + "|" + file.size + "|" + file.lastModified;
      if (S.F.some((f) => f.chiave === chiave)) { S.avviso = "Una foto era già stata aggiunta."; continue; }
      const seg = { chiave, lavoro: true }; S.F.push(seg); disegna();
      try { seg.blob = await riduci(file); seg.url = URL.createObjectURL(seg.blob); seg.lavoro = false; }
      catch (e) { S.F.splice(S.F.indexOf(seg), 1); S.avviso = e.message; }
      disegna();
    }
    disegna(); errore("", true);
  }
  function togli(i) {
    const f = S.F[i]; if (!f || f.lavoro) return;
    if (f.url) URL.revokeObjectURL(f.url);
    S.F.splice(i, 1); S.avviso = ""; disegna();
  }

  /* ---------- modulo ---------- */
  const NOMI = ["marca", "modello", "versione", "anno", "km", "alimentazione", "cambio", "cv", "colore", "targa", "proprietari", "tagliandi", "doppia_chiave", "condizioni", "incidenti", "finanziata", "difetti", "accessori", "cosa", "prezzo", "quando", "permuta_con", "note", "nome", "telefono", "email", "contatto_pref", "fascia"];
  const CAMPO = { consenso: "privacy" };
  function leggiCampi(f) {
    const d = {}; NOMI.forEach((k) => (d[k] = f.elements[k] ? f.elements[k].value : ""));
    d.consenso_privacy = f.privacy.checked; d.consenso_marketing = f.marketing.checked; d.sito = f.sito.value;
    return d;
  }
  function errore(msg, soloFoto) {
    const e = $("#ve-err");
    if (soloFoto && !e.dataset.foto) return;
    e.textContent = msg; e.hidden = !msg; e.dataset.foto = "";
    if (!msg) $("#ve-form").querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
  }
  function mostraErrori(errori) {
    const f = $("#ve-form"); errore("");
    const trovati = [];
    Object.keys(errori).forEach((k) => {
      if (k === "foto") { trovati.push({ el: $("#ve-aggiungi"), msg: errori.foto, foto: true }); $("#ve-stato").classList.add("manca"); return; }
      const el = f.elements[CAMPO[k] || k];
      if (el) { el.setAttribute("aria-invalid", "true"); trovati.push({ el, msg: errori[k] }); } else trovati.push({ el: null, msg: errori[k] });
    });
    // il primo errore nell'ordine in cui compaiono nel modulo
    const ordine = [...f.querySelectorAll("input,select,textarea,#ve-aggiungi")];
    trovati.sort((a, b) => (a.el ? ordine.indexOf(a.el) : 999) - (b.el ? ordine.indexOf(b.el) : 999));
    const p = trovati[0], e = $("#ve-err"); e.textContent = p.msg + (trovati.length > 1 ? ` (e ${trovati.length - 1} ${trovati.length === 2 ? "altro campo" : "altri campi"} da controllare)` : ""); e.hidden = false; e.dataset.foto = p.foto ? "1" : "";
    if (p.el && p.el.focus) { p.el.focus(); if (p.el.scrollIntoView) p.el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
  }
  function chiuso(motivo) {
    const tel = (S.cfg.contatti || {}).telefono, c = $("#ve-chiuso");
    $("#ve-form").hidden = true; c.hidden = false;
    c.innerHTML = `<p><b>${esc(motivo || "L’invio online non è disponibile in questo momento.")}</b></p><p>${tel ? `Chiamaci al <b>${esc(tel)}</b> e ti diciamo quanto vale la tua auto.` : "Scrivici per farla valutare."}</p>`;
  }

  async function invia(ev) {
    ev.preventDefault();
    if (S.inviando) return;
    const f = $("#ve-form"), btn = $("#ve-invia");
    errore("");
    if (S.F.some((x) => x.lavoro)) return mostraErrori({ foto: "Aspetta un attimo: sto ancora preparando le foto." });
    const dati = leggiCampi(f), foto = S.F.filter((x) => x.blob);
    const val = R.valida(dati, foto.length, new Date().getFullYear());
    if (!val.ok) return mostraErrori(val.errori);
    S.inviando = true; btn.disabled = true; btn.textContent = "Invio in corso…";
    try {
      if (S.locale) await salvaDemo(dati, val, foto);
      else {
        const fd = new FormData(); fd.append("dati", JSON.stringify(dati));
        foto.forEach((x, i) => fd.append("foto", x.blob, `foto-${i + 1}.jpg`));
        const res = await fetch("api/vendi", { method: "POST", body: fd });
        let j = {}; try { j = await res.json(); } catch (e) { /* risposta senza JSON */ }
        if (res.status === 201 || (res.ok && j.ok)) conferma(val.valori);
        else if (res.status === 422 && j.errori) mostraErrori(j.errori);
        else if (res.status === 429) errore(j.messaggio || "Hai inviato troppe richieste: riprova tra un’ora o chiamaci.");
        else if (res.status === 413 || res.status === 415) errore(j.messaggio || "Le foto non sono state accettate: provane altre.");
        else if (res.status === 404 || res.status === 503) chiuso();
        else errore(j.messaggio || "Non siamo riusciti a registrare la richiesta. Riprova o chiamaci" + ((S.cfg.contatti || {}).telefono ? " al " + S.cfg.contatti.telefono : "") + ".");
      }
    } catch (e) { errore("Connessione assente: la richiesta non è partita. Riprova tra poco."); }
    finally { S.inviando = false; btn.disabled = false; btn.textContent = "Chiedi la valutazione"; }
  }
  async function salvaDemo(dati, val, foto) {
    const iso = new Date().toISOString(), id = "d" + Date.now().toString(36), nomi = [], mappa = leggi(FOTO, {});
    for (let i = 0; i < foto.length; i++) { try { const n = `demo-${id}-${i + 1}.jpg`; mappa[n] = await miniatura(foto[i].blob); nomi.push(n); } catch (e) { /* una miniatura in meno */ } }
    let nota = "";
    if (!scrivi(FOTO, mappa)) { nomi.length = 0; nota = "Le foto non stanno nella memoria di questo browser: la demo conserva solo i dati."; }
    const doc = R.norm(Object.assign({}, val.valori, { id, stato: "nuova", origine: "vetrina", creato: iso, aggiornato: iso, foto: nomi.join("|"), demo: true,
      consenso: { privacy: true, marketing: dati.consenso_marketing === true, versione: R.VERSIONE_PRIVACY, data: iso } }));
    const coda = leggi(CODA, []); coda.push(doc); scrivi(CODA, coda);
    conferma(val.valori, nota);
  }

  function conferma(v, nota) {
    const f = $("#ve-form"), box = $("#ve-ok"), c = S.cfg.contatti || {}, mesi = (((S.cfg.privacy || {}).conservazione || {}).richieste_mesi) || R.MESI_DEFAULT;
    const pref = { telefono: "al telefono", whatsapp: "su WhatsApp", email: "per email" }[v.contatto_pref] || "";
    f.hidden = true; box.hidden = false;
    box.innerHTML = `<h3 id="ve-ok-t" tabindex="-1">Richiesta inviata</h3>
      <p>Grazie${v.nome ? ", " + esc(v.nome.split(/\s+/)[0]) : ""}. Abbiamo ricevuto i dati e le foto della tua <b>${esc(R.titolo(v))}</b>. Ti ricontattiamo ${pref ? esc(pref) + " " : ""}${v.telefono ? "al <b>" + esc(v.telefono) + "</b> " : ""}per la valutazione.</p>
      <p>I dati e le foto restano riservati e li cancelliamo dopo ${mesi} mesi.${c.telefono ? " Se hai fretta, chiamaci al " + esc(c.telefono) + "." : ""}</p>
      ${S.locale ? '<p class="tg-nota">Demo: la richiesta resta in questo browser. Aprila nel gestionale, scheda «Valutazioni».' + (nota ? " " + esc(nota) : "") + "</p>" : ""}
      <div class="tg-azioni"><button type="button" class="btn btn-line" id="ve-altra">Valuta un’altra auto</button><a class="btn btn-line" href="#auto">Torna alle auto</a></div>`;
    const t = $("#ve-ok-t"); if (t) t.focus();
  }
  function ricomincia() {
    S.F.forEach((x) => x.url && URL.revokeObjectURL(x.url)); S.F = []; S.avviso = "";
    const f = $("#ve-form"); f.reset(); f.hidden = false; $("#ve-ok").hidden = true; errore(""); disegna();
    $("#vendi").scrollIntoView({ behavior: "auto", block: "start" });
  }

  /* ---------- avvio ---------- */
  const opz = (id, lista) => { const el = $(id); if (el) el.insertAdjacentHTML("beforeend", lista.map((x) => (Array.isArray(x) ? `<option value="${esc(x[0])}">${esc(x[1])}</option>` : `<option>${esc(x)}</option>`)).join("")); };
  AP.Vendi = {
    async init(cfg) {
      S.cfg = cfg; S.locale = cfg.demo === true;
      const sez = $("#vendi"); if (!sez) return;
      const attivo = !!(cfg.moduli && cfg.moduli.vendi === true);
      document.querySelectorAll("[data-modulo=vendi]").forEach((e) => (e.hidden = !attivo));
      if (!attivo) return;
      if (!S.locale) {
        try {
          const res = await fetch("api/vendi", { headers: { accept: "application/json" }, cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const j = await res.json();
          if (!j.attivo) throw new Error("spento");
          if (j.foto) S.lim = { min: +j.foto.min || R.FOTO_MIN, max: +j.foto.max || R.FOTO_MAX, byte: +j.foto.byte || R.FOTO_BYTE };
        } catch (e) { chiuso(); return; }
      }
      opz("#ve-alimentazione", R.ALIMENTAZIONI); opz("#ve-cambio", R.CAMBI); opz("#ve-condizioni", R.CONDIZIONI); opz("#ve-incidenti", R.INCIDENTI);
      opz("#ve-tagliandi", R.TAGLIANDI); opz("#ve-finanziata", R.FINANZIATA); opz("#ve-cosa", R.COSA); opz("#ve-quando", R.QUANDO); opz("#ve-contatto", R.CONTATTO);
      $("#ve-min").textContent = `(almeno ${S.lim.min})`; $("#ve-min-n").textContent = S.lim.min; $("#ve-max-n").textContent = S.lim.max;
      if (S.locale) $("#ve-nota").insertAdjacentHTML("afterend", '<p class="pr-nota"><b>Demo:</b> la richiesta resta in questo browser e compare nel gestionale, scheda «Valutazioni».</p>');
      disegna();
      const file = $("#ve-file"), drop = $("#ve-drop");
      $("#ve-aggiungi").addEventListener("click", () => file.click());
      file.addEventListener("change", () => { const l = [...file.files]; file.value = ""; aggiungi(l); });
      $("#ve-tessere").addEventListener("click", (e) => {
        const t = e.target.closest(".tolgo"); if (t) return togli(+t.dataset.i);
        if (e.target.closest(".vuota") && S.F.length < S.lim.max) file.click();
      });
      ["dragenter", "dragover"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add("sopra"); }));
      ["dragleave", "drop"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove("sopra"); }));
      drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) aggiungi(e.dataTransfer.files); });
      $("#ve-form").addEventListener("submit", invia);
      $("#ve-form").addEventListener("input", (e) => { if (e.target.hasAttribute && e.target.hasAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid"); });
      $("#ve-ok").addEventListener("click", (e) => { if (e.target.id === "ve-altra") ricomincia(); });
    },
  };
})();
