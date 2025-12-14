"use strict";

/* ================= GLOBAL ================= */
let LAST_CODES = null;

/* ================= UTIL ================= */
function readFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsText(file);
  });
}

function freq(data) {
  const f = {};
  data.forEach(x => f[x] = (f[x] || 0) + 1);
  return f;
}

/* ================= SHANNON–FANO ================= */
function shannonFano(freq) {
  const items = Object.entries(freq).sort((a,b) => b[1] - a[1]);
  const codes = {};
  items.forEach(([s]) => codes[s] = "");

  function split(list) {
    if (list.length <= 1) return;

    const total = list.reduce((a,b) => a + b[1], 0);
    let acc = 0, idx = 0;

    for (let i = 0; i < list.length; i++) {
      acc += list[i][1];
      if (acc >= total / 2) {
        idx = i;
        break;
      }
    }

    const L = list.slice(0, idx + 1);
    const R = list.slice(idx + 1);

    L.forEach(([s]) => codes[s] += "0");
    R.forEach(([s]) => codes[s] += "1");

    split(L);
    split(R);
  }

  if (items.length === 1) {
    codes[items[0][0]] = "0";
  } else {
    split(items);
  }

  return codes;
}

/* ================= HUFFMAN ================= */
class Node {
  constructor(sym, freq, left=null, right=null) {
    this.sym = sym;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

function huffman(freq) {
  let heap = Object.entries(freq).map(([s,f]) => new Node(s,f));
  if (heap.length === 1) return { [heap[0].sym]: "0" };

  while (heap.length > 1) {
    heap.sort((a,b) => a.freq - b.freq);
    const a = heap.shift();
    const b = heap.shift();
    heap.push(new Node(null, a.freq + b.freq, a, b));
  }

  const codes = {};
  (function walk(n, code) {
    if (n.sym !== null) {
      codes[n.sym] = code;
      return;
    }
    walk(n.left, code + "0");
    walk(n.right, code + "1");
  })(heap[0], "");

  return codes;
}

/* ================= ENCODE / DECODE ================= */
function encode(data, codes) {
  return data.map(x => codes[x]).join("");
}

function decode(bits, codes) {
  const inv = {};
  Object.entries(codes).forEach(([k,v]) => inv[v] = k);

  let buf = "", out = "";
  for (const b of bits) {
    buf += b;
    if (inv[buf]) {
      out += inv[buf];
      buf = "";
    }
  }
  return out;
}

/* ================= MAIN PROCESS ================= */
async function encodeProcess() {
  let text = document.getElementById("textInput").value;
  const file = document.getElementById("fileInput").files[0];

  if (file) text = await readFile(file);
  if (!text) {
    alert("Data kosong");
    return;
  }

  const method = document.getElementById("method").value;
  let data = [...text];

  const f = freq(data);
  const codes = (method === "hf") ? huffman(f) : shannonFano(f);
  const bits = encode(data, codes);

  LAST_CODES = codes;

  document.getElementById("bitstream").innerText = bits;
  document.getElementById("codebook").innerText =
    JSON.stringify(codes, null, 2);
}

/* ================= DOWNLOAD ================= */
function downloadBits() {
  if (!LAST_CODES) {
    alert("Belum ada hasil encoding");
    return;
  }

  const blob = new Blob(
    [document.getElementById("bitstream").innerText],
    { type: "text/plain" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "encoded_bits.txt";
  a.click();
}

function downloadInfo() {
  if (!LAST_CODES) {
    alert("Belum ada data");
    return;
  }

  const blob = new Blob(
    [JSON.stringify(LAST_CODES, null, 2)],
    { type: "text/plain" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tabel_statistik.txt";
  a.click();
}

/* ================= DECODE ================= */
async function decodeProcess() {
  const file = document.getElementById("bitFile").files[0];
  if (!file || !LAST_CODES) {
    alert("File bit atau hasil encoding belum ada");
    return;
  }

  const bits = (await readFile(file)).replace(/[^01]/g, "");
  document.getElementById("decodedText").innerText =
    decode(bits, LAST_CODES);
}
