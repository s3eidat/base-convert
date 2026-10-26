/* Base Convert — BigInt base conversion, two's complement, bit grid, UTF-8 bytes. All local. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$, h = S3.h;
  var DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

  // ---------- core ----------
  // base: 2..36 or "auto" (0x / 0b / 0o prefixes, otherwise decimal). Returns {ok, value: BigInt} or {ok:false, error}.
  function parse(str, base) {
    var s = String(str).trim().replace(/[\s_,']/g, "").toLowerCase();
    if (!s) return { ok: false, error: "empty" };
    var neg = false;
    if (s[0] === "-" || s[0] === "+") { neg = s[0] === "-"; s = s.slice(1); }
    var pre = { "0x": 16, "0b": 2, "0o": 8 }[s.slice(0, 2)];
    if (base === "auto") base = pre || 10;
    if (pre && pre === +base) s = s.slice(2);
    base = +base;
    if (!s) return { ok: false, error: "no digits" };
    if (s.indexOf(".") >= 0) return { ok: false, error: "whole numbers only" };
    var v = 0n, B = BigInt(base);
    for (var i = 0; i < s.length; i++) {
      var d = DIGITS.indexOf(s[i]);
      if (d < 0 || d >= base) return { ok: false, error: "“" + s[i] + "” is not a base-" + base + " digit" };
      v = v * B + BigInt(d);
    }
    return { ok: true, value: neg ? -v : v };
  }
  function toBase(v, base) { return v < 0n ? "-" + (-v).toString(base) : v.toString(base); }
  function group(str, size, sep) {
    var neg = str[0] === "-", s = neg ? str.slice(1) : str, out = "";
    for (var i = s.length; i > 0; i -= size) out = s.slice(Math.max(0, i - size), i) + (out ? sep + out : "");
    return (neg ? "-" : "") + out;
  }
  function twos(v, w) {
    var u = BigInt.asUintN(w, v), max = (1n << BigInt(w)) - 1n, min = -(1n << BigInt(w - 1));
    return { unsigned: u, signed: BigInt.asIntN(w, v), fits: v >= min && v <= max,
      hex: u.toString(16).toUpperCase().padStart(w / 4, "0"), bin: u.toString(2).padStart(w, "0") };
  }
  function bitLength(v) { if (v < 0n) v = -v; return v === 0n ? 0 : v.toString(2).length; }

  var enc = new TextEncoder();
  function textToBytes(t) { return enc.encode(t); }
  function fmtBytes(bytes, fmt, upper) {
    return Array.prototype.map.call(bytes, function (b) {
      if (fmt === "bin") return b.toString(2).padStart(8, "0");
      if (fmt === "dec") return String(b);
      var x = b.toString(16).padStart(2, "0"); return upper ? x.toUpperCase() : x;
    }).join(" ");
  }
  // Accepts "48 65", "4865", "0x48,0x65", "01001000 01100101", "72 101". Returns {ok, bytes} or {ok:false,error}.
  function parseBytes(str, fmt) {
    var s = String(str).trim();
    if (!s) return { ok: true, bytes: new Uint8Array(0) };
    var parts;
    if (fmt === "hex") {
      s = s.replace(/0x/gi, "").replace(/[\s,:;-]/g, "");
      if (!/^[0-9a-f]*$/i.test(s)) return { ok: false, error: "Hex bytes use 0–9 and A–F" };
      if (s.length % 2) return { ok: false, error: "Odd number of hex digits" };
      parts = s.match(/../g).map(function (p) { return parseInt(p, 16); });
    } else if (fmt === "bin") {
      s = s.replace(/[\s,]/g, "");
      if (!/^[01]*$/.test(s)) return { ok: false, error: "Binary bytes use only 0 and 1" };
      if (s.length % 8) return { ok: false, error: "Binary needs whole bytes (multiples of 8 bits)" };
      parts = s.match(/.{8}/g).map(function (p) { return parseInt(p, 2); });
    } else {
      parts = s.split(/[\s,]+/).map(Number);
      if (parts.some(function (n) { return !Number.isInteger(n) || n < 0 || n > 255; })) return { ok: false, error: "Decimal bytes are 0–255" };
    }
    return { ok: true, bytes: new Uint8Array(parts) };
  }
  function decode(bytes) {
    try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), valid: true }; }
    catch (e) { return { text: new TextDecoder("utf-8").decode(bytes), valid: false }; }
  }

  // ---------- number UI ----------
  var ROWS = [[2, "Binary", 4, " "], [8, "Octal", 3, " "], [10, "Decimal", 3, ","], [16, "Hex", 4, " "], [36, "Base 36", 0, ""], ["any", "Base", 0, ""]];
  var st = { num: null, base: S3.store("bc.base") || "auto", width: S3.store("bc.width") || 32, signed: false, bytefmt: S3.store("bc.bytefmt") || "hex" };
  var anySel = $("#base-any"), outs = $("#outs");
  for (var b = 2; b <= 36; b++) anySel.appendChild(h("option", { value: b, text: "Base " + b }));

  var customBase = S3.store("bc.custom") || 3;
  ROWS.forEach(function (r) {
    var lbl = r[0] === "any" ? h("select", { "class": "select mini", id: "custom-base", "aria-label": "Custom output base" }) : h("span", { "class": "lab" }, [r[1], h("small", { text: "base " + r[0] })]);
    if (r[0] === "any") for (var b2 = 2; b2 <= 36; b2++) lbl.appendChild(h("option", { value: b2, text: "Base " + b2, selected: b2 === customBase }));
    outs.appendChild(h("div", { "class": "orow" }, [lbl,
      h("input", { "class": "input mono", "data-base": r[0], autocomplete: "off", spellcheck: "false", dir: "ltr", "aria-label": r[1] + " value" }),
      h("button", { "class": "btn icon small ghost", "data-copy": r[0], "aria-label": "Copy " + r[1], title: "Copy" }, [svgIcon("copy")])]));
  });
  function svgIcon(name) { var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "i"); var u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", "#i-" + name); s.appendChild(u); return s; }
  function rowBase(key) { return key === "any" ? +$("#custom-base").value : +key; }
  function shown(v, key) {
    var r = ROWS.filter(function (x) { return String(x[0]) === String(key); })[0], s = toBase(v, rowBase(key));
    if ($("#upper").checked && rowBase(key) > 10) s = s.toUpperCase();
    return $("#group").checked && r[2] ? group(s, r[2], r[3]) : s;
  }

  function renderNumber(skip) {
    var v = st.num;
    $$("#outs input").forEach(function (inp) { if (inp !== skip) inp.value = v === null ? "" : shown(v, inp.dataset.base); });
    $("#bits").textContent = v === null ? "" : bitLength(v) + " bits · " + Math.ceil(bitLength(v) / 8 || 0) + " bytes" + (v < 0n ? " (magnitude)" : "");
    renderTwos();
  }
  function setStatus(ok, msg) { var s = $("#status"); s.className = "chip " + (ok === null ? "" : ok ? "ok" : "bad"); s.textContent = msg; }

  $("#value").addEventListener("input", function () {
    var r = parse(this.value, st.base);
    if (!this.value.trim()) { st.num = null; setStatus(null, "Type a number"); renderNumber(); return; }
    if (!r.ok) { setStatus(false, r.error); return; }
    st.num = r.value; setStatus(true, "Valid"); renderNumber();
  });
  outs.addEventListener("input", function (e) {
    var inp = e.target; if (!inp.dataset.base) return;
    var r = parse(inp.value, rowBase(inp.dataset.base));
    if (!inp.value.trim()) return;
    if (!r.ok) { setStatus(false, r.error); return; }
    st.num = r.value; setStatus(true, "Valid"); $("#value").value = toBase(r.value, 10); renderNumber(inp);
  });
  outs.addEventListener("focusout", function () { renderNumber(); });
  outs.addEventListener("change", function (e) { if (e.target.id === "custom-base") { S3.store("bc.custom", +e.target.value); renderNumber(); } });
  outs.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]"); if (!b || st.num === null) return;
    S3.copy(toBase(st.num, rowBase(b.dataset.copy))[$("#upper").checked ? "toUpperCase" : "toLowerCase"]()); S3.done();
  });
  ["group", "upper"].forEach(function (id) { $("#" + id).addEventListener("change", function () { S3.store("bc." + id, this.checked); renderNumber(); renderBytesFromText(); }); });
  ["group", "upper"].forEach(function (id) { var v = S3.store("bc." + id); if (typeof v === "boolean") $("#" + id).checked = v; });

  function seg(id, value, onPick) {
    $$("#" + id + " button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === String(value)));
      b.addEventListener("click", function () { $$("#" + id + " button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.dataset.v); });
    });
  }
  function pickBase(v) {
    st.base = v; S3.store("bc.base", v);
    anySel.value = v === "auto" ? "" : v;
    $$("#base-seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.v === String(v))); });
    $("#value").dispatchEvent(new Event("input"));
  }
  seg("base-seg", st.base, pickBase);
  anySel.insertBefore(h("option", { value: "", text: "—" }), anySel.firstChild);
  anySel.value = st.base === "auto" ? "" : st.base;
  anySel.addEventListener("change", function () { pickBase(this.value || "auto"); });

  // ---------- two's complement + bit grid ----------
  function stat(label, value) { return h("div", { "class": "stat" }, [h("b", { "class": "mono", text: value }), h("span", { text: label })]); }
  function renderTwos() {
    var w = +st.width, box = $("#tc-stats"), grid = $("#bitgrid"), v = st.num === null ? 0n : st.num, t = twos(v, w);
    box.textContent = "";
    box.appendChild(stat("signed int" + w, t.signed.toString()));
    box.appendChild(stat("unsigned uint" + w, t.unsigned.toString()));
    box.appendChild(stat("hex", "0x" + group(t.hex, 4, " ")));
    $("#tc-note").textContent = st.num === null ? "Range for " + w + " bits: " + (-(1n << BigInt(w - 1))) + " to " + ((1n << BigInt(w)) - 1n) + "."
      : t.fits ? "Fits in " + w + " bits. Signed range " + (-(1n << BigInt(w - 1))) + " to " + ((1n << BigInt(w - 1)) - 1n) + "."
      : "Does not fit in " + w + " bits: it wraps around, keeping only the low " + w + " bits.";
    $("#tc-note").className = st.num !== null && !t.fits ? "faint warn-t" : "faint";
    grid.textContent = "";
    for (var byte = w / 8 - 1; byte >= 0; byte--) {
      var g = h("div", { "class": "byte" }), cells = h("div", { "class": "cells" });
      for (var bit = 7; bit >= 0; bit--) {
        var idx = byte * 8 + bit, on = t.bin[w - 1 - idx] === "1";
        cells.appendChild(h("button", { "class": "bit" + (on ? " on" : "") + (idx === w - 1 ? " sign" : ""), "data-bit": idx, "aria-pressed": String(on),
          "aria-label": "Bit " + idx, title: "Bit " + idx + (idx === w - 1 ? " (sign bit)" : ""), text: on ? "1" : "0" }));
      }
      g.appendChild(cells); g.appendChild(h("span", { "class": "faint", text: (byte * 8 + 7) + "–" + byte * 8 }));
      grid.appendChild(g);
    }
  }
  function setFromPattern(u) {
    var w = +st.width;
    st.num = st.signed ? BigInt.asIntN(w, u) : BigInt.asUintN(w, u);
    $("#value").value = st.num.toString(); pickBaseSilently(); setStatus(true, "Valid"); renderNumber();
  }
  function pickBaseSilently() { st.base = "10"; anySel.value = "10"; $$("#base-seg button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.v === "10")); }); }
  $("#bitgrid").addEventListener("click", function (e) {
    var b = e.target.closest(".bit"); if (!b) return;
    var u = BigInt.asUintN(+st.width, st.num === null ? 0n : st.num) ^ (1n << BigInt(b.dataset.bit));
    setFromPattern(u);
    var again = $('.bit[data-bit="' + b.dataset.bit + '"]'); if (again) again.focus();
  });
  $("#invert").addEventListener("click", function () { var w = +st.width; setFromPattern(BigInt.asUintN(w, ~(st.num === null ? 0n : st.num))); });
  seg("width-seg", st.width, function (v) { st.width = +v; S3.store("bc.width", st.width); renderTwos(); });
  seg("sign-seg", "u", function (v) { st.signed = v === "s"; });

  // ---------- text <-> bytes ----------
  var textEl = $("#text"), bytesEl = $("#bytes");
  function bstatus(ok, msg) { var s = $("#byte-status"); s.className = "chip " + (ok ? "ok" : "bad"); s.textContent = msg; }
  function renderBytesFromText() {
    var b = textToBytes(textEl.value);
    bytesEl.value = fmtBytes(b, st.bytefmt, $("#upper").checked);
    $("#byte-info").textContent = b.length + " bytes · " + Array.from(textEl.value).length + " characters";
    bstatus(true, "UTF-8");
  }
  textEl.addEventListener("input", renderBytesFromText);
  bytesEl.addEventListener("input", function () {
    var r = parseBytes(bytesEl.value, st.bytefmt);
    if (!r.ok) { bstatus(false, r.error); return; }
    var d = decode(r.bytes); textEl.value = d.text;
    $("#byte-info").textContent = r.bytes.length + " bytes";
    bstatus(d.valid, d.valid ? "Valid UTF-8" : "Not valid UTF-8: shown with � replacements");
  });
  seg("byte-seg", st.bytefmt, function (v) { st.bytefmt = v; S3.store("bc.bytefmt", v); renderBytesFromText(); });
  $("#copy-text").addEventListener("click", function () { S3.copy(textEl.value); S3.done(); });
  $("#copy-bytes").addEventListener("click", function () { S3.copy(bytesEl.value); S3.done(); });

  renderNumber(); renderBytesFromText();

  window.S3_DEMO = function () {
    pickBase("auto"); $("#value").value = "0xC0FFEE"; $("#value").dispatchEvent(new Event("input"));
    textEl.value = "Hi ☕ مرحبا"; renderBytesFromText();
  };

  window.S3_SELFTEST = function () {
    var p = function (s, b) { var r = parse(s, b); return r.ok ? r.value : r.error; };
    var big = 2n ** 100n;
    var t1 = twos(-1n, 8), t2 = twos(200n, 8), t3 = twos(-1n, 64), t4 = twos(256n, 8), t5 = twos(-128n, 8);
    var hiBytes = fmtBytes(textToBytes("Hi ☕"), "hex", true);
    var back = parseBytes("01001000 01101001", "bin");
    return p("ff", 16) === 255n && p("0x1F", "auto") === 31n && p("-0b101", "auto") === -5n && p("0o17", "auto") === 15n &&
      p("z", 36) === 35n && p("1_000_000", 10) === 1000000n && typeof p("12", 2) === "string" && typeof p("1.5", 10) === "string" &&
      toBase(big, 10) === "1267650600228229401496703205376" && p("1" + "0".repeat(25), 16) === big && toBase(-255n, 16) === "-ff" &&
      group("11111111", 4, " ") === "1111 1111" && group("-1234567", 3, ",") === "-1,234,567" &&
      t1.hex === "FF" && t1.unsigned === 255n && t2.signed === -56n && t2.fits && t3.hex === "FFFFFFFFFFFFFFFF" && !t4.fits && t4.unsigned === 0n &&
      t5.bin === "10000000" && t5.fits && bitLength(255n) === 8 && bitLength(0n) === 0 &&
      hiBytes === "48 69 20 E2 98 95" && decode(back.bytes).text === "Hi" && parseBytes("0x48,0x69", "hex").bytes.length === 2 &&
      decode(parseBytes("ff", "hex").bytes).valid === false && !parseBytes("abc", "hex").ok && !parseBytes("256", "dec").ok &&
      decode(parseBytes("72 105", "dec").bytes).text === "Hi";
  };
})();
