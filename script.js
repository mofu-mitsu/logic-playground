/**
 * ソシオTi強度チェッカー - 論理研究室
 * 究極完全版：タッチバグ完全修正・イベントクリーンアップ・GAS送信対応
 */

// ★★★ GASウェブアプリURL ★★★
const GAS_URL = "https://script.google.com/macros/s/AKfycbyMFoYMXm7JKXL-3CrLJcidpznYMOZEDXzhnMBWE9P3JgJFUQPCZeWWZvuL7KJWFg-CVQ/exec";

let currentQ = 0;
let questionOrder = []; 
let scores = {
  leading: 0, creative: 0, normative: 0, vulnerable: 0,
  suggestive: 0, proof: 0, mobilizing: 0, ignoring: 0
};
let tiUserPoints = 0;   
let tiMaxPossible = 0; 
let seFlag = false;    
let questionStartTime = 0;
let actionLog = []; 
let history = []; 

// イベントリーク（透明なゴミ）防止用配列
let activeDocListeners = [];

document.body.style.overflowX = "hidden";

/* --- イベントクリーンアップ関数（スマホバグ防止の要） --- */
function clearDocListeners() {
  activeDocListeners.forEach(l => document.removeEventListener(l.type, l.fn, l.options));
  activeDocListeners = [];
}
function addDocListener(type, fn, options) {
  document.addEventListener(type, fn, options);
  activeDocListeners.push({ type, fn, options });
}

function showScreen(id) {
  ["start-screen", "loading-screen", "question-screen", "result-screen"].forEach(s => {
    const el = document.getElementById(s); if(el) el.classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

function processLoading(text, callback) {
  document.getElementById("loader-text").innerText = text;
  showScreen("loading-screen"); setTimeout(callback, 1200); 
}

document.getElementById("exit-btn").onclick = (e) => {
  e.preventDefault();
  const startScreen = document.getElementById("start-screen");
  if (!startScreen.classList.contains("hidden")) { window.location.href = "https://mofu-mitsu.github.io/lab.html"; } 
  else { if (confirm("研究を中断してタイトルに戻りますか？\n（現在のログは失われます）")) { location.reload(); } }
};

document.getElementById("start-btn").onclick = () => {
  if (typeof questions === 'undefined') return alert("data.jsが読み込まれていません");
  questionOrder = [...Array(questions.length).keys()].sort(() => Math.random() - 0.5);
  currentQ = 0; tiUserPoints = 0; tiMaxPossible = 0; actionLog = []; history = [];
  scores = { leading:0, creative:0, normative:0, vulnerable:0, suggestive:0, proof:0, mobilizing:0, ignoring:0 };
  seFlag = false;
  processLoading("論理マトリックスを初期化中...", () => { showScreen("question-screen"); renderQuestion(); });
};

/* --- 究極のドラッグ関数（ワープ防止＆タッチバグ防止） --- */
function setupDraggable(element, onDropCallback) {
  let clone = null;
  let offsetX = 0, offsetY = 0;

  const onMove = (e) => {
    if (!clone) return;
    if (e.cancelable && e.type === "touchmove") e.preventDefault(); // ドラッグ中のみスクロール防止
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    clone.style.left = (clientX - offsetX) + "px";
    clone.style.top = (clientY - offsetY) + "px";
  };

  const onEnd = (e) => {
    if (!clone) return;
    element.style.opacity = "1";
    clone.style.display = 'none'; 
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const dropTarget = document.elementFromPoint(clientX, clientY);
    clone.remove(); clone = null;
    
    // ドラッグが終わったらイベントを消す
    clearDocListeners();
    if (onDropCallback) onDropCallback(clientX, clientY, element, dropTarget);
  };

  const onStart = (e) => {
    if (clone) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = element.getBoundingClientRect();
    offsetX = clientX - rect.left; offsetY = clientY - rect.top;

    clone = element.cloneNode(true);
    clone.classList.add("dragging-clone");
    clone.style.position = 'fixed'; clone.style.zIndex = "9999";
    clone.style.width = rect.width + "px"; clone.style.height = rect.height + "px";
    clone.style.left = rect.left + "px"; clone.style.top = rect.top + "px";
    clone.style.pointerEvents = "none"; clone.style.opacity = "0.9"; clone.style.boxShadow = "0 0 15px #38bdf8";
    document.body.appendChild(clone);
    element.style.opacity = "0.1";
    if (e.type === "mousedown") e.preventDefault();

    // ドラッグ中のみ監視を開始
    addDocListener('mousemove', onMove, { passive: false });
    addDocListener('touchmove', onMove, { passive: false });
    addDocListener('mouseup', onEnd, false);
    addDocListener('touchend', onEnd, false);
  };

  element.addEventListener('mousedown', onStart);
  element.addEventListener('touchstart', onStart, { passive: false });
}

function logAction(msg, pts, max) {
  const elapsed = ((Date.now() - questionStartTime) / 1000).toFixed(1);
  actionLog.push(`[Q${currentQ + 1}] ${elapsed}s: ${msg} (${pts}/${max}pt)`);
}

function saveHistory() { history.push({ currentQ, scores: JSON.parse(JSON.stringify(scores)), tiUserPoints, tiMaxPossible, actionLog: [...actionLog], seFlag }); }
function goBack() {
  if (history.length === 0) return;
  clearDocListeners(); // ゴミ掃除
  const h = history.pop();
  currentQ = h.currentQ; scores = h.scores; tiUserPoints = h.tiUserPoints; tiMaxPossible = h.tiMaxPossible; actionLog = h.actionLog; seFlag = h.seFlag;
  renderQuestion();
}
function next() { currentQ++; renderQuestion(); }

let bugClicks = 0; const bug = document.getElementById("bug"); const bugBubble = document.getElementById("bug-bubble"); const bugCont = document.getElementById("bug-container");
setInterval(() => { if (!bug || bug.classList.contains("splashed")) return; bugCont.style.left = Math.floor(Math.random() * (window.innerWidth - 120)) + "px"; }, 5000);
bug.onclick = () => {
  if (bugClicks >= 30) return; bugClicks++; bugBubble.classList.remove("hidden");
  if (bugClicks === 30) { seFlag = true; bug.innerHTML = "💥"; bug.classList.add("splashed"); bugBubble.innerText = "ギャァァァアア！！"; setTimeout(() => { if(bugCont) bugCont.style.display = "none"; }, 2500); }
  else { bugBubble.innerText = `[${bugClicks}/30] ${bugQuotes[bugClicks % bugQuotes.length]}`; }
};

setInterval(() => {
  if (document.getElementById("question-screen").classList.contains("hidden") || currentQ >= questions.length) return;
  if (Math.random() > 0.7) {
    const d = document.getElementById("darling-container"); const b = document.getElementById("darling-bubble");
    if(b) b.innerText = darlingQuotes[Math.floor(Math.random() * darlingQuotes.length)];
    if(d) d.classList.remove("hidden"); setTimeout(() => { if(d) d.classList.add("hidden"); }, 5500);
  }
}, 13000);

function renderQuestion() {
  clearDocListeners(); 
  const container = document.getElementById("question-container");
  container.innerHTML = "";
  container.style.border = ""; container.style.background = "";
  questionStartTime = Date.now();

  if (currentQ >= questions.length) return processLoading("全論理データを構造化中...", showResult);

  const qIndex = questionOrder[currentQ];
  const q = questions[qIndex];
  const type = q.type.trim();

  // 進捗
  const prog = document.createElement("div");
  prog.style.textAlign = "right"; prog.style.color = "#38bdf8"; prog.style.fontSize = "0.75rem";
  prog.innerText = `[ 工程: ${currentQ + 1} / ${questions.length} ]`;
  container.appendChild(prog);

  const title = document.createElement("h3");
  title.innerHTML = q.text;
  container.appendChild(title);

  // 強度計算用の次元重み（4D: 1.0 / 3D: 0.8 / 2D: 0.5 / 1D: 0.1）
  const tiStrengthWeights = {
    leading: 1.0, proof: 1.0, creative: 0.8, ignoring: 0.8,
    mobilizing: 0.6, normative: 0.4, suggestive: 0.2, vulnerable: 0.1
  };

  // --- 1. ダーリン介入 (Q17) ---
  if (type === "darling_interception") {
    const qMax = 40; tiMaxPossible += qMax; // この問題の満点は40点
    container.style.border = "2px solid #f472b6";
    container.style.background = "rgba(190, 24, 93, 0.1)";
    const msg = document.createElement("p");
    msg.innerHTML = "<b style='color:#f472b6;'>ダーリンちゃん(ILI):</b><br>「ねえダーリン、こんな診断で君がわかると思ってるの？♡」";
    container.appendChild(msg);

    const dChoices = [
      { t: "定義さえ厳密なら全ては法則に収束する", f: "leading", s: 40 },
      { t: "無理に決まってる。アラを探すのが楽しいだけ", f: "proof", s: 40 },
      { t: "知らん。早く終わらせろ", f: "vulnerable", s: 50 }
    ];
    dChoices.forEach(c => {
      const btn = document.createElement("button");
      btn.className = "choice-btn"; btn.style.borderColor = "#f472b6"; btn.innerText = c.t;
      btn.onclick = () => {
        saveHistory(); scores[c.f] += c.s;
        // Leading/Proofなら満点加算
        let p = (c.f === "leading" || c.f === "proof") ? qMax : (c.s * tiStrengthWeights[c.f]);
        tiUserPoints += p;
        logAction(c.t.substring(0,6), Math.round(p), qMax); next();
      };
      container.appendChild(btn);
    });
    return; // 介入時はスキップボタン等を出さない
  }

  // --- 2. 通常の選択肢系 ---
  else if (["choice", "time_trap", "strawberry_logic", "emotion_logic", "unresolved_logic", "diogenes_trap", "suggestive_ti", "ti_valued_check", "mobilizing_ti_gimmick"].includes(type)) {
    const qMax = Math.max(...q.choices.map(c => c.score || 0));
    tiMaxPossible += qMax;
    const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
    shuffled.forEach(c => {
      const btn = document.createElement("button");
      btn.className = "choice-btn"; btn.innerText = c.text;
      btn.onclick = () => {
        saveHistory();
        const elapsed = Date.now() - questionStartTime;
        if (elapsed < 1200) scores.vulnerable += 20; 

        scores[c.func] += c.score;
        // 強度計算（主導・証明は分母の満点を与える）
        let p = (c.func === "leading" || c.func === "proof") ? qMax : (c.score * (tiStrengthWeights[c.func] || 0));
        tiUserPoints += p;

        logAction(c.text.substring(0,10), Math.round(p), qMax); next();
      };
      container.appendChild(btn);
    });
  }

  // --- 3. スライダー (Q2) ---
  else if (type === "slider") {
    const qMax = 40; tiMaxPossible += qMax;
    const sli = document.createElement("input"); sli.type="range"; sli.min="0"; sli.max="100"; sli.step="0.1"; sli.value="12.5";
    const valDisp = document.createElement("div"); valDisp.className="slider-value"; valDisp.innerText="12.5";
    sli.oninput = (e) => valDisp.innerText = parseFloat(e.target.value).toFixed(1);
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="値を確定";
    btn.onclick = () => {
      saveHistory();
      const v = parseFloat(sli.value);
      let p = (v === 50.0) ? qMax : (Math.abs(v - 50) <= 1.0 ? 20 : 0);
      if (v === 50.0) scores.leading += 30; else if (p > 0) scores.normative += 20; else scores.vulnerable += 30;
      tiUserPoints += p; logAction(`Slider:${v}`, p, qMax); next();
    };
    container.appendChild(sli); container.appendChild(valDisp); container.appendChild(btn);
  }

  // --- 4. ズレ直し (Q3) ---
  else if (type === "align_fix") {
    const qMax = 30; tiMaxPossible += qMax;
    const wrap = document.createElement("div"); wrap.style.display="flex"; wrap.style.justifyContent="center"; wrap.style.gap="15px"; wrap.style.margin="25px 0";
    let fixed = false;
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("div"); b.className = "align-box";
      if (i === 2) { b.classList.add("misaligned"); b.onclick = () => { b.classList.remove("misaligned"); b.style.boxShadow="0 0 15px #38bdf8"; fixed = true; }; }
      wrap.appendChild(b);
    }
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="次へ";
    btn.onclick = () => {
      saveHistory();
      if (fixed) { scores.leading += 25; tiUserPoints += qMax; } else { scores.vulnerable += 30; }
      logAction(fixed?"ズレ修正":"放置", fixed ? qMax : 0, qMax); next();
    };
    container.appendChild(wrap); container.appendChild(btn);
  }

  // --- 5. 自由配置 (Q7) ---
  else if (type === "align_free") {
    const qMax = 30; tiMaxPossible += qMax;
    const area = document.createElement("div"); area.style.height="260px"; area.style.position="relative"; area.style.border="2px dashed #38bdf8"; area.style.background="rgba(0,0,0,0.25)"; area.style.marginBottom="15px";
    const boxes = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("div"); b.className = "align-box"; b.style.position="absolute";
      b.style.top = (i * 45) + "px"; b.style.left = (i * 45) + "px";
      setupDraggable(b, (x, y, el) => {
        const r = area.getBoundingClientRect(); el.style.position = 'absolute';
        el.style.left = Math.min(Math.max(x - r.left - 25, 0), r.width - 50) + "px"; el.style.top = Math.min(Math.max(y - r.top - 25, 0), r.height - 50) + "px";
        el.dataset.moved = "true"; area.appendChild(el);
      });
      area.appendChild(b); boxes.push(b);
    }
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="この配置で確定";
    btn.onclick = () => {
      saveHistory();
      let corners = 0; let yC = []; let xC = [];
      boxes.forEach(b => {
        const l = parseInt(b.style.left), t = parseInt(b.style.top); yC.push(t); xC.push(l);
        if ((l < 50 || l > area.offsetWidth - 80) && (t < 50 || t > area.offsetHeight - 80)) corners++;
      });
      const isAligned = (Math.max(...yC) - Math.min(...yC) < 20 || Math.max(...xC) - Math.min(...xC) < 20);
      let p = (isAligned || corners >= 3) ? qMax : 10;
      if (corners >= 3) { scores.creative += 25; seFlag = true; } else if (isAligned) { scores.leading += 25; } else { scores.vulnerable += 20; }
      tiUserPoints += p; logAction(isAligned?"整列(Ti)": (corners>=3?"四隅(Se)":"適当"), p, qMax); next();
    };
    container.appendChild(area); container.appendChild(btn);
  }

  // --- 6. 二重分類 (Q6) ---
  else if (type === "classification") {
    const qMax = 40; tiMaxPossible += qMax;
    const wrap = document.createElement("div"); wrap.className="folder-wrap";
    const f1 = document.createElement("div"); f1.className="folder"; f1.id="v-folder"; f1.innerHTML="<b>野菜</b>";
    const f2 = document.createElement("div"); f2.className="folder"; f2.id="f-folder"; f2.innerHTML="<b>果物</b>";
    const pool = document.createElement("div"); pool.id="item-pool"; pool.style.minHeight="70px"; pool.style.border="1px solid #38bdf8"; pool.style.padding="10px"; pool.style.margin="15px 0"; pool.style.display="flex"; pool.style.gap="8px"; pool.style.flexWrap="wrap";
    ["トマト", "スイカ", "アボカド", "イチゴ"].forEach(txt => {
      const it = document.createElement("div"); it.className="draggable-item"; it.innerText=txt;
      setupDraggable(it, (x, y, el, target) => {
        if (target && target.closest("#v-folder")) f1.appendChild(el); else if (target && target.closest("#f-folder")) f2.appendChild(el); else pool.appendChild(el);
        el.style.position="static";
      });
      pool.appendChild(it);
    });
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="分類を終了";
    btn.onclick = () => { saveHistory(); tiUserPoints += qMax; scores.leading += 20; logAction("仕分け完了", qMax, qMax); next(); };
    wrap.appendChild(f1); wrap.appendChild(f2); container.appendChild(wrap); container.appendChild(pool); container.appendChild(btn);
  }

  // --- 7. 境界線 (Q9) ---
  else if (type === "black_white_boundary") {
    const qMax = 35; tiMaxPossible += qMax;
    const bar = document.createElement("div"); bar.className="gradient-bar";
    const handle = document.createElement("div"); handle.className="boundary-handle"; handle.style.left="5%"; bar.appendChild(handle);
    let clicked = false;
    handle.onmousedown = handle.ontouchstart = (e) => { 
      clicked = true;
      const move = (me) => {
        const mx = me.touches ? me.touches[0].clientX : me.clientX; const r = bar.getBoundingClientRect();
        let p = mx - r.left; if(p<0)p=0; if(p>r.width)p=r.width;
        handle.style.left = p + "px"; handle.dataset.val = (p/r.width)*100;
      };
      const stop = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", stop); document.removeEventListener("touchmove", move); document.removeEventListener("touchend", stop); };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", stop); document.addEventListener("touchmove", move, {passive:false}); document.addEventListener("touchend", stop);
    };
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="境界を確定";
    btn.onclick = () => {
      saveHistory(); let v = parseFloat(handle.dataset.val || 5);
      let p = (clicked && v > 89) ? qMax : 10;
      if (v > 89) scores.leading += 25; else scores.normative += 20;
      tiUserPoints += p; logAction(`B-Line:${v.toFixed(1)}%`, p, qMax); next();
    };
    container.appendChild(bar); container.appendChild(btn);
  }

  // --- 8. 説明書 (Q12) ---
  else if (type === "manual_gimmick") {
    const qMax = 50; tiMaxPossible += qMax;
    const mBox = document.createElement("div"); mBox.style.fontSize="0.75rem"; mBox.style.background="rgba(0,0,0,0.4)"; mBox.style.padding="10px"; mBox.style.border="1px solid #38bdf8"; mBox.style.textAlign="left"; mBox.innerHTML = q.manual_text; container.appendChild(mBox);
    const pList = document.createElement("div"); pList.style.display="flex"; pList.style.flexDirection="column"; pList.style.gap="8px"; pList.style.margin="15px 0";
    let order = 1;
    q.steps.forEach(s => {
      const btn = document.createElement("div"); btn.className="choice-btn"; btn.style.textAlign="left"; btn.style.position="relative"; btn.innerText = s.text;
      btn.onclick = () => {
        if(btn.dataset.order){ btn.dataset.order = ""; btn.classList.remove("btn-active"); btn.querySelector(".badge-order").remove(); order--; }
        else { btn.dataset.order = order; btn.classList.add("btn-active"); const bg = document.createElement("span"); bg.className="badge-order"; bg.innerText = order; btn.appendChild(bg); order++; }
      };
      pList.appendChild(btn);
    });
    const go = document.createElement("button"); go.className="choice-btn"; go.innerText="この手順で実行";
    go.onclick = () => {
      saveHistory(); const firstStep = Array.from(pList.children).find(el => el.dataset.order === "1");
      let p = (firstStep && firstStep.innerText.includes("フィルム")) ? qMax : 0;
      if (p === qMax) scores.leading += 30; else scores.vulnerable += 30;
      tiUserPoints += p; logAction("Manual", p, qMax); next();
    };
    container.appendChild(pList); container.appendChild(go);
  }

  // --- 9. 文章修正デバッグ (Q19) ---
  else if (type === "text_debug") {
    const qMax = 30; tiMaxPossible += qMax;
    const qText = document.createElement("p"); qText.style.background="rgba(255,255,255,0.05)"; qText.style.padding="10px"; qText.style.textAlign="left";
    qText.innerText = "「論理的な整合せいが保たれていないシステムは、いずれ崩壊する。例外を放置することは、定義の曖昧さを許容することだ。」"; container.appendChild(qText);
    const input = document.createElement("input"); input.className="debug-input"; input.placeholder="正しい漢字を入力してください"; container.appendChild(input);
    const fixBtn = document.createElement("button"); fixBtn.className="choice-btn"; fixBtn.innerText="修正を適用";
    fixBtn.onclick = () => {
      saveHistory(); let val = input.value.trim();
      let p = (val === "整合性" || val === "性") ? qMax : 0;
      if (p === qMax) scores.leading += 25; else scores.vulnerable += 25;
      tiUserPoints += p; logAction(`Debug:${val}`, p, qMax); next();
    };
    container.appendChild(fixBtn);
  }

  // --- 10. 情報の木 (Q13) ---
  else if (type === "logic_tree") {
    const qMax = 35; tiMaxPossible += qMax;
    const treeF = document.createElement("div"); treeF.className="folder"; treeF.style.width="95%"; treeF.innerHTML="<b>食べ物</b>";
    const treeP = document.createElement("div"); treeP.style.padding="10px"; treeP.style.display="flex"; treeP.style.gap="8px"; treeP.style.flexWrap="wrap";
    ["いちご","トマト","草","耳のキノコ","脇のもやし"].forEach(tx => {
      const item = document.createElement("div"); item.className="draggable-item"; item.innerText=tx;
      setupDraggable(item, (x,y,el,target) => { if(target && target.closest(".folder")) treeF.appendChild(el); else treeP.appendChild(el); el.style.position="static"; });
      treeP.appendChild(item);
    });
    const ok = document.createElement("button"); ok.className="choice-btn"; ok.innerText="確定";
    ok.onclick = () => {
      saveHistory(); 
      const inFolder = Array.from(treeF.querySelectorAll('.draggable-item')).map(el => el.innerText);
      let p = 0; let msg = "";
      if (inFolder.length === 2 && inFolder.includes("いちご") && inFolder.includes("トマト")) { scores.leading += 30; p = qMax; msg = "厳密な分類(主導Ti)"; } 
      else if (inFolder.includes("耳のキノコ") || inFolder.includes("脇のもやし")) { scores.creative += 30; p = qMax; msg = "創造的分類(創造Ti)"; } 
      else { scores.vulnerable += 20; p = 10; msg = "不完全な分類"; }
      tiUserPoints += p; logAction(msg, p, qMax); next();
    };
    container.appendChild(treeF); container.appendChild(treeP); container.appendChild(ok);
  }

  // --- 11. 創造Tiギミック (Q20) ---
  else if (type === "creative_ti_gimmick") {
    const qMax = 30; tiMaxPossible += qMax;
    const slot = document.createElement("div"); slot.className="folder"; slot.id="exp-slot"; slot.style.width="95%"; slot.style.minHeight="80px"; slot.innerHTML="<b>【説明スロット(2つまで)】</b>";
    const pArea = document.createElement("div"); pArea.style.display="flex"; pArea.style.flexDirection="column"; pArea.style.gap="5px"; pArea.style.margin="10px 0";
    q.blocks.forEach(b => {
      const item = document.createElement("div"); item.className="draggable-item"; item.style.display="block"; item.innerText=b.text; item.dataset.id = b.id;
      setupDraggable(item, (x,y,el,target) => { if(target && target.closest("#exp-slot") && slot.querySelectorAll(".draggable-item").length < 2) slot.appendChild(el); else pArea.appendChild(el); el.style.position="static"; });
      pArea.appendChild(item);
    });
    const finish = document.createElement("button"); finish.className="choice-btn"; finish.innerText="これで説明する";
    finish.onclick = () => {
      saveHistory(); const ids = Array.from(slot.querySelectorAll(".draggable-item")).map(el => el.dataset.id);
      if (ids.includes("B") || ids.includes("C") || ids.includes("D")) { scores.creative += 30; tiUserPoints += qMax; logAction("創造的説明", qMax, qMax); }
      else { scores.leading += 25; tiUserPoints += 20; logAction("主導的説明", 20, qMax); }
      next();
    };
    container.appendChild(slot); container.appendChild(pArea); container.appendChild(finish);
  }

  // --- 12. パラドックス、ルール適用 ---
  else if (type === "paradox_gimmick") {
    const qMax = 40; tiMaxPossible += qMax;
    q.rules.forEach(r => {
      const rb = document.createElement("button"); rb.className="choice-btn"; rb.innerText=r.text;
      rb.onclick = () => { saveHistory(); let p = (r.id === "C") ? qMax : 0; if(p===qMax) scores.proof += 30; else scores.vulnerable += 30; tiUserPoints += p; logAction(`Paradox:${r.id}`, p, qMax); next(); };
      container.appendChild(rb);
    });
  }
  else if (type === "rule_application") {
    const qMax = 45; tiMaxPossible += qMax;
    const w = document.createElement("div"); w.style.display="flex"; w.style.flexWrap="wrap"; w.style.gap="10px";
    ["A","B","C","D"].forEach(l => { const box = document.createElement("div"); box.className="folder"; box.id="b-"+l; box.style.width="45%"; box.style.minHeight="60px"; box.innerHTML=`<b>BOX ${l}</b>`; w.appendChild(box); });
    const obj = document.createElement("div"); obj.className="draggable-item"; obj.innerText="青くて四角い物体";
    setupDraggable(obj, (x,y,el,target) => { const box = target ? target.closest(".folder") : null; if(box) { box.appendChild(el); el.style.position="static"; } });
    container.appendChild(obj); container.appendChild(w);
    const b = document.createElement("button"); b.className="choice-btn"; b.innerText="適用完了";
    b.onclick = () => { saveHistory(); const ok = document.getElementById("b-D").querySelector(".draggable-item"); let p = ok ? qMax : 0; if(ok) scores.proof += 30; else scores.vulnerable += 30; tiUserPoints += p; logAction(ok?"Rule:OK":"Rule:NG", p, qMax); next(); };
    container.appendChild(b);
  }

  // --- 共通フッター ---
  const footer = document.createElement("div"); footer.style.marginTop = "25px"; footer.style.display = "flex"; footer.style.gap = "10px";
  const backBtn = document.createElement("button"); backBtn.className = "choice-btn"; backBtn.style.flex = "1"; backBtn.style.background = "rgba(255,255,255,0.05)";
  backBtn.innerHTML = "<i class='fa-solid fa-arrow-left'></i> 戻る"; backBtn.onclick = goBack;
  if (history.length === 0) backBtn.style.opacity = "0.3";
  const skipBtn = document.createElement("button"); skipBtn.className = "choice-btn"; skipBtn.style.flex = "2"; skipBtn.style.background = "rgba(100,116,139,0.2)";
  skipBtn.innerHTML = "判定不能 / スキップ"; skipBtn.onclick = () => { saveHistory(); scores.vulnerable += 30; logAction("Skip", 0, 0); next(); };
  footer.appendChild(backBtn); footer.appendChild(skipBtn); container.appendChild(footer);
}

function next() { currentQ++; renderQuestion(); }

// --- 結果表示＆GAS送信 ---
// --- 結果表示 ---
function showResult() {
  showScreen("result-screen");
  const res = document.getElementById("result-screen");
  const selfId = document.getElementById("self-id").value || "未登録研究員";

  let str = Math.min(100, Math.floor((tiUserPoints / tiMaxPossible) * 100));
  
  // scoresに存在するキーだけで判定（undefined対策）
  const validKeys = ["leading", "creative", "normative", "vulnerable", "suggestive", "proof", "mobilizing", "ignoring"];
  let high = validKeys.reduce((a, b) => scores[a] > scores[b] ? a : b);

  // マップ（8機能＋α）
  const map = { 
    leading: "主導Ti (LII/LSI)", 
    creative: "創造Ti (ILE/SLE)", 
    normative: "規範Ti (ESI/EII)", 
    vulnerable: "脆弱Ti (SEE/IEE)", 
    suggestive: "暗示Ti (ESE/EIE)", 
    proof: "証明Ti (ILI/SLI)", 
    mobilizing: "動員Ti (SEI/IEI)", 
    ignoring: "無視Ti (LIE/LSE)", 
    fe_lead: "感情主導(Fe-Leading)", 
    se_lead: "感覚主導(Se-Leading)" 
  };
  
  // ダーリンちゃんのセリフ分岐
  let darlingSpeech = "";
  if (seFlag) darlingSpeech = darlingResultQuotes.se[Math.floor(Math.random() * darlingResultQuotes.se.length)];
  else if (str >= 80) darlingSpeech = darlingResultQuotes.high[Math.floor(Math.random() * darlingResultQuotes.high.length)];
  else if (str >= 50) darlingSpeech = darlingResultQuotes.mid[Math.floor(Math.random() * darlingResultQuotes.mid.length)];
  else darlingSpeech = darlingResultQuotes.low[Math.floor(Math.random() * darlingResultQuotes.low.length)];

  let logHtml = "<div data-html2canvas-ignore='true' style='font-size:0.65rem; color:#94a3b8; height:130px; overflow-y:scroll; border:1px solid #475569; padding:10px; margin-top:20px; background:rgba(0,0,0,0.3); text-align:left;'><strong>[システム詳細ログ]</strong><br>";
  actionLog.forEach(l => logHtml += `<div style='border-bottom:1px solid #334155; padding:2px;'>${l}</div>`);
  logHtml += "</div>";

  res.innerHTML = `
    <h2>RESEARCH COMPLETED</h2>
    <div style="font-size: 3.8rem; color: #38bdf8; font-weight:bold; margin: 10px 0; text-shadow:0 0 15px rgba(56,189,248,0.5);">${str}%</div>
    <p style="font-size:1.2rem;">推定配置: <strong style="border-bottom:2px solid #38bdf8;">${map[high]}</strong></p>
    <div style="text-align:left; background:rgba(255,255,255,0.08); padding:20px; border-radius:15px; margin-top:20px; font-size:0.85rem; line-height:1.7;">
      ${seFlag ? "<p style='color:#ff4d4d; font-weight:bold;'>【ALERT】Se衝動を検知。論理を『支配』の道具とするSLEの才能が眠っています。</p>" : "<p style='color:#a3e635;'>【REPORT】芋虫は生存。論理的一貫性と世界の構造への敬意を維持しています。</p>"}
      <strong>ダーリンちゃん(ILI)の毒言:</strong><br>
      <i style="color:#f472b6;">「${darlingSpeech}」</i>
      ${logHtml}
    </div>
    
    <div class="result-actions" data-html2canvas-ignore="true">
      <button id="save-img-btn" class="action-btn"><i class="fa-solid fa-camera"></i> 結果を画像保存</button>
      <button id="share-btn" class="action-btn"><i class="fa-solid fa-share-nodes"></i> シェアする</button>
      <button id="copy-log-btn" class="action-btn"><i class="fa-solid fa-clipboard"></i> ログをコピー</button>
    </div>
    
    <button class="choice-btn" data-html2canvas-ignore="true" style="margin-top:20px; border:2px solid #38bdf8;" onclick="location.reload()">再研究（もう一度遊ぶ）</button>
  `;

  // GAS送信
  if (GAS_URL && GAS_URL.startsWith("http")) {
    fetch(GAS_URL, {
      method: 'POST', body: JSON.stringify({ selfId: selfId, strength: str, resultType: map[high], actionLog: actionLog }),
      headers: { 'Content-Type': 'application/json' }, mode: 'no-cors'
    }).catch(e => console.log("GAS Send Error:", e));
  }

  // 画像保存
  document.getElementById('save-img-btn').onclick = () => {
    html2canvas(document.querySelector('.glass-container'), {backgroundColor: '#0f172a'}).then(canvas => {
      let link = document.createElement('a'); link.download = 'ti-checker-result.png'; link.href = canvas.toDataURL(); link.click();
    });
  };
  
  // シェア
  document.getElementById('share-btn').onclick = () => {
    if (navigator.share) navigator.share({ title: 'ソシオTi強度チェッカー', text: `【論理研究室】\n私のTi強度は${str}%、推定配置は【${map[high]}】でした！\n#ソシオニクス\n`, url: window.location.href });
    else alert("お使いのブラウザは共有機能に対応していません。");
  };
  
  // ログコピー
  document.getElementById('copy-log-btn').onclick = () => {
    navigator.clipboard.writeText("【システム詳細ログ】\n" + actionLog.join("\n")).then(() => { alert("詳細ログをコピーしました！"); });
  };
}
