"use strict";

let LAST_CODES = null;
let LAST_FREQ = null;
let LAST_DATA_LEN = 0;
let LAST_EXT2 = false;

/* ===================== UTIL ===================== */
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

/* ================= Shannon–Fano ================= */
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

/* ================= Huffman ================= */
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

/* ================= Encode & Decode ================= */
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

/* ================= Statistik (untuk file download) ================= */
function calculateStats(freq, codes, isEXT2) {
  let H = 0;
  let L = 0;
  const total = Object.values(freq).reduce((a,b) => a + b, 0);

  for (const sym in freq) {
    const p = freq[sym] / total;
    const l = codes[sym].length;
    H += -p * Math.log2(p);
    L += p * l;
  }

  if (isEXT2) {
    H /= 2;
    L /= 2;
  }

  return {
    H: H.toFixed(4),
    L: L.toFixed(4),
    E: ((H / L) * 100).toFixed(2)
  };
}

/* ================= Main Process ================= */
async function encodeProcess() {
  let text = document.getElementById("textInput").value;
  const file = document.getElementById("fileInput").files[0];

  if (file) text = await readFile(file);
  if (!text || text.length < 1000) {
    alert("Minimal 1000 simbol ASCII");
    return;
  }

  const method = document.getElementById("method").value;
  let data = [...text];
  let isEXT2 = false;

  if (method === "ext2") {
    const letters = data.filter(c => /[A-Za-z]/.test(c));
    data = [];
    for (let i = 0; i < letters.length - 1; i += 2) {
      data.push(letters[i] + letters[i + 1]);
    }
    isEXT2 = true;
  }

  const f = freq(data);
  const codes = (method === "hf") ? huffman(f) : shannonFano(f);
  const bits = encode(data, codes);

  LAST_CODES = codes;
  LAST_FREQ = f;
  LAST_DATA_LEN = data.length;
  LAST_EXT2 = isEXT2;

  document.getElementById("bitstream").innerText = bits;
  document.getElementById("codebook").innerText =
    JSON.stringify(codes, null, 2);
}

/* ================= Download ================= */
function downloadBits() {
  if (!LAST_CODES) return alert("Belum ada hasil encoding");

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
  if (!LAST_CODES) return alert("Belum ada data");

  const stats = calculateStats(LAST_FREQ, LAST_CODES, LAST_EXT2);
  const info =
`Jumlah simbol        : ${LAST_DATA_LEN}
Entropi (H)           : ${stats.H}
Rata-rata panjang (L) : ${stats.L}
Efisiensi (%)         : ${stats.E}

Tabel Statistik (Codebook):
${JSON.stringify(LAST_CODES, null, 2)}
`;

  const blob = new Blob([info], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "encoding_info.txt";
  a.click();
}

/* ================= Decode ================= */
async function decodeProcess() {
  const file = document.getElementById("bitFile").files[0];
  if (!file || !LAST_CODES) {
    alert("File bit atau hasil encoding belum tersedia");
    return;
  }

  const bits = (await readFile(file)).replace(/[^01]/g, "");
  document.getElementById("decodedText").innerText =
    decode(bits, LAST_CODES);
}
