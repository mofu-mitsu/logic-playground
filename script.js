/**
 * ソシオTi強度チェッカー - 論理研究室
 * 究極完全版：タッチバグ完全修正・イベントクリーンアップ・GAS送信対応
 */

// ★★★ GASウェブアプリURL ★★★
const GAS_URL_MAIL = "https://script.google.com/macros/s/AKfycbyMFoYMXm7JKXL-3CrLJcidpznYMOZEDXzhnMBWE9P3JgJFUQPCZeWWZvuL7KJWFg-CVQ/exec"; 
const GAS_URL_SHEET = "https://script.google.com/macros/s/AKfycbwCORRWpMjZgIQT8qhdOlLHokXgRRN5BRctsf_znFE7W-T-tBrZeXpH6s8R6h5Q7MQ/exec";
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
let textChoiceCounts = { leading: 0, creative: 0, normative: 0, vulnerable: 0, suggestive: 0, proof: 0, mobilizing: 0, ignoring: 0 };
function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => { toast.classList.remove("show"); }, 3000);
}


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
  if (typeof questions === 'undefined') return alert("data.js not found.");
  questionOrder = [...Array(questions.length).keys()].sort(() => Math.random() - 0.5);
  currentQ = 0; tiUserPoints = 0; tiMaxPossible = 0; actionLog = []; history = [];
  scores = { leading:0, creative:0, normative:0, vulnerable:0, suggestive:0, proof:0, mobilizing:0, ignoring:0, fe_lead:0, se_lead:0 };
  
  // ★スタート時にリセット★
  textChoiceCounts = { leading: 0, creative: 0, normative: 0, vulnerable: 0, suggestive: 0, proof: 0, mobilizing: 0, ignoring: 0 };
  
  seFlag = false;
  processLoading("論理マトリックスを初期化中...", () => { showScreen("question-screen"); renderQuestion(); });
};

/* --- 究極のドラッグ関数（ワープ防止＆タッチバグ防止） --- */
function setupDraggable(element, onDropCallback) {
  let offsetX = 0, offsetY = 0;
  let placeholder = null;
  let originalParent = null;
  let originalNextSibling = null;

  function onStart(e) {
    if (e.type === "mousedown") e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = element.getBoundingClientRect();
    
    // 指で掴んだ位置のズレ（オフセット）を記録
    offsetX = cx - rect.left;
    offsetY = cy - rect.top;

    originalParent = element.parentNode;
    originalNextSibling = element.nextSibling;

    // 元の場所が詰まらないように透明な「身代わり」を置く
    placeholder = document.createElement("div");
    placeholder.style.width = rect.width + "px";
    placeholder.style.height = rect.height + "px";
    placeholder.style.margin = getComputedStyle(element).margin;
    originalParent.insertBefore(placeholder, element);

    // ★ガラスUIのバグを回避するため、body直下に出して動かす★
    document.body.appendChild(element);
    element.style.position = "fixed";
    element.style.zIndex = "9999";
    element.style.left = rect.left + "px";
    element.style.top = rect.top + "px";
    element.style.margin = "0";

    addDocListener('mousemove', onMove, { passive: false });
    addDocListener('touchmove', onMove, { passive: false });
    addDocListener('mouseup', onEnd, false);
    addDocListener('touchend', onEnd, false);
  }

  function onMove(e) {
    if (e.cancelable && e.type === "touchmove") e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    element.style.left = (cx - offsetX) + "px";
    element.style.top = (cy - offsetY) + "px";
  }

  function onEnd(e) {
    clearDocListeners();
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    
    // 一時的に自身を隠して下のフォルダを判定
    element.style.display = "none";
    const dropTarget = document.elementFromPoint(cx, cy);
    element.style.display = "block";

    // スタイルを元に戻す
    element.style.position = "static";
    element.style.zIndex = "";
    element.style.left = "";
    element.style.top = "";
    element.style.margin = "";

    // いったん「身代わり」の場所に戻す（この直後に分類フォルダ等に移動される）
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(element, placeholder);
      placeholder.parentNode.removeChild(placeholder);
    } else if (originalParent) {
      originalParent.insertBefore(element, originalNextSibling);
    }

    if (onDropCallback) {
      // 空間配置のズレを防ぐため、offX と offY も渡す！
      onDropCallback(cx, cy, element, dropTarget, offsetX, offsetY);
    }
  }

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

// --- 芋虫 🐛 ＆ 蝶 🦋 ギミック ---
// --- 🐛 芋虫 ＆ 🦋 蝶（モグラ叩き＆羽化・飛翔仕様） ---
let bugClicks = 0; 
let isBugDead = false; // 蛹（瀕死）フラグ
let isButterfly = false; // 蝶フラグ
const bug = document.getElementById("bug"); 
const bugBubble = document.getElementById("bug-bubble"); 
const bugCont = document.getElementById("bug-container");

// 最初は透明にしておく＆CSSアニメーションの設定
bugCont.style.opacity = "0";
bugCont.style.transition = "opacity 0.3s ease-in-out, transform 2.5s ease-in, left 0.5s ease-out";

let bugMoveInterval = setInterval(() => { 
  if (!bug || isBugDead || isButterfly) return; 
  
  // ランダムな位置にひょっこり出現
  bugCont.style.left = Math.floor(Math.random() * (window.innerWidth - 120)) + "px"; 
  bugCont.style.opacity = "1"; // 出現

  // 3.5秒経ったらスッと隠れる（邪魔にならないように）
  setTimeout(() => {
    if (!isBugDead && !isButterfly) {
      bugCont.style.opacity = "0";
      bugBubble.classList.add("hidden"); // 吹き出しも消す
    }
  }, 3500);

}, 7000); // 7秒ごとに判定

bug.onclick = () => {
  // ★★★ 🦋 蝶になった後のタップ処理（大空へ羽ばたく！） ★★★
  if (isButterfly) {
    bugBubble.innerText = "LSI: 重力という例外処理を実行します！お先に失礼。";
    bugBubble.style.color = "#38bdf8";
    
    // 【較正】イージングを調整して、画面の一番上までしっかり飛んでから消えるように変更！
    // cubic-bezier(0.8, 0, 1, 1) により、最初は透明にならず、上部に達した瞬間にスッと溶けるように消えます！
    bugCont.style.transition = "transform 3.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 3.2s cubic-bezier(0.8, 0, 1, 1)";
    bugCont.style.transform = "translateY(-140vh) rotate(1080deg) scale(0.2)";
    bugCont.style.opacity = "0";
    
    setTimeout(() => {
      if(bugCont) bugCont.style.display = "none";
    }, 3200);
    
    showToast("LSI蝶はシステムの外（大空）へ旅立ちました🦋");
    return;
  }

  // 通常タップのカウント
  bugClicks++; 
  bugBubble.classList.remove("hidden");
  
  if (bugClicks === 30) { 
    isBugDead = true; 
    seFlag = true; 
    
    // ★アニメーションによる透明化を完全に打ち消し、💥をキープする修正★
    bug.innerHTML = "💥"; 
    bug.style.animation = "none"; 
    bug.style.opacity = "1";
    bug.style.display = "inline-block";
    
    bugBubble.innerText = "ギャァァァアア！！（LSI: 秩序の崩壊です…）"; 
    bugBubble.style.color = "#ef4444";
    logAction("芋虫破壊(Se)", 0, 0);
  } 
  else if (bugClicks === 50) {
    isButterfly = true;
    bug.innerHTML = "🦋"; 
    bug.classList.remove("splashed");
    bug.style.animation = "none";
    bug.style.opacity = "1";
    bug.style.transform = "scale(1.5)"; // 蝶を目立たせるために少し大きく
    
    bugBubble.innerText = "LSI: 非合理的な制限（蛹）から解放されました。秩序は自ら構築します。"; 
    bugBubble.style.color = "#38bdf8";
    scores.creative += 50; 
    logAction("バグを仕様に昇華(創造Ti)", 0, 0);
    showToast("隠し要素：LSI蝶が羽化しました🦋");
  } 
  else if (bugClicks < 30) { 
    bugBubble.innerText = `[${bugClicks}/30] ${bugQuotes[bugClicks % bugQuotes.length]}`; 
  } 
  else {
    // 31〜49回目（蛹のピクピク期間。💥が見えるようになったよ！）
    bugBubble.innerText = `[${bugClicks}/50] LSI: ...規則的にピクピクしています...`; 
  } 
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

  // 質問がすべて終わったら結果画面へ
  if (currentQ >= questions.length) return processLoading("最終論理整合性をコンパイル中...", showResult);

  const qIndex = questionOrder[currentQ];
  const q = questions[qIndex];
  if (!q) return;
  const type = q.type.trim();

  // --- 進捗表示 ---
  const prog = document.createElement("div");
  prog.className = "progress-indicator";
  prog.style.textAlign = "right"; prog.style.color = "#38bdf8"; prog.style.fontSize = "0.75rem";
  prog.innerText = `[ ANALYSIS STEP: ${currentQ + 1} / ${questions.length} ]`;
  container.appendChild(prog);

  // --- タイトル表示 ---
  const title = document.createElement("h3");
  title.innerHTML = q.text;
  container.appendChild(title);

  // 【みつき定義：強度重み係数】これをすべての計算の基盤にする
  const tiStrengthWeights = {
    leading: 1.0,    // 4D: 主導 (最強)
    proof: 0.9,      // 4D: 証明 (最強レベル)
    creative: 0.8,   // 3D: 創造 (強い)
    ignoring: 0.7,   // 3D: 無視 (強いけど使わない)
    mobilizing: 0.5, // 2D: 動員 (普通)
    normative: 0.4,  // 2D: 規範 (普通)
    suggestive: 0.2, // 1D: 暗示 (弱い)
    vulnerable: 0.1  // 1D: 脆弱 (最弱)
  };

  // ==========================================
  // ギミック分岐：一切の共通化を廃止し詳細に記述
  // ==========================================

  // ------------------------------------------
  // 1. ダーリン介入ギミック
  // ------------------------------------------
  if (type === "darling_interception") {
    const qMaxScore = 40; 
    container.style.border = "2px solid #f472b6";
    container.style.background = "rgba(190, 24, 93, 0.1)";
    const msg = document.createElement("p");
    msg.innerHTML = "<b style='color:#f472b6;'>ダーリンちゃん(ILI):</b><br>「ねえダーリン、こんな4択で人間の複雑な精神構造が完全に分類できるって、本気で思ってるの？♡」";
    container.appendChild(msg);

    const dChoices = [
      { t: "定義さえ厳密なら全ては法則に収束する", f: "leading", s: 40 },
      { t: "無理に決まってる。アラを探すのが楽しいだけ", f: "proof", s: 40 },
      { t: "知らん。結果だけ早く出せ", f: "vulnerable", s: 50 }
    ];

    dChoices.forEach(c => {
      const btn = document.createElement("button");
      btn.className = "choice-btn"; btn.style.borderColor = "#f472b6"; btn.innerText = c.t;
      btn.onclick = () => {
        saveHistory();
        tiMaxPossible += qMaxScore; // 分母確定
        scores[c.f] += c.s;
        
        let p = (c.f === "leading" || c.f === "proof") ? qMaxScore : (c.s * tiStrengthWeights[c.f]);
        tiUserPoints += p;
        logAction(c.t.substring(0,6), Math.round(p), qMaxScore);
        next();
      };
      container.appendChild(btn);
    });
    return;
  }

  // ------------------------------------------
  // 2. 通常のテキスト選択肢系 (いちご、動員など)
  // ------------------------------------------
// --- 2. 通常の選択肢系 ---
// 2. 通常のテキスト選択肢系 (Q17のダーリン介入の「次」にあるやつね！)
  else if (["choice", "time_trap", "strawberry_logic", "emotion_logic", "unresolved_logic", "diogenes_trap", "suggestive_ti", "ti_valued_check", "mobilizing_ti_gimmick"].includes(type)) {
    const qMaxScore = Math.max(...q.choices.map(c => c.score || 0), 10);
    tiMaxPossible += qMaxScore;

    const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
    shuffled.forEach(c => {
      const btn = document.createElement("button"); btn.className = "choice-btn"; btn.innerText = c.text;
      btn.onclick = () => {
        saveHistory(); 
        const elapsed = Date.now() - questionStartTime;
        if (elapsed < 1200) { scores.vulnerable += 25; scores.leading -= 15; }

        let basePoints = c.score || 0;
        scores[c.func] += basePoints;

        // ★ここを追加！テキストで選んだ機能をカウント★
        if (textChoiceCounts[c.func] !== undefined) textChoiceCounts[c.func]++;

        // 強度の計算
        let addedPoints = 0;
        if (c.func === "leading" || c.func === "proof") { addedPoints = qMaxScore; } 
        else { addedPoints = basePoints * (tiStrengthWeights[c.func] || 0.1); }
        tiUserPoints += addedPoints;

        logAction(c.text.substring(0,10), Math.round(addedPoints), qMaxScore);
        next();
      };
      container.appendChild(btn);
    });
  }

  // ------------------------------------------
  // 3. スライダー (Q2)
  // ------------------------------------------
// ------------------------------------------
  // 3. 動くタイミングバー (旧：スライダー)
  // ------------------------------------------
  else if (type === "timing_bar") {
    const qMaxScore = 40;
    tiMaxPossible += qMaxScore;

    const wrap = document.createElement("div");
    wrap.style.position = "relative"; wrap.style.width = "100%"; wrap.style.height = "45px";
    wrap.style.background = "rgba(0,0,0,0.5)"; wrap.style.border = "2px solid #38bdf8";
    wrap.style.borderRadius = "25px"; wrap.style.margin = "20px 0"; wrap.style.overflow = "hidden";

    const targetLine = document.createElement("div");
    targetLine.style.position = "absolute"; targetLine.style.left = "50%"; targetLine.style.top = "0";
    targetLine.style.width = "4px"; targetLine.style.height = "100%";
    targetLine.style.background = "#f472b6"; targetLine.style.transform = "translateX(-50%)";
    targetLine.style.boxShadow = "0 0 10px #f472b6";
    wrap.appendChild(targetLine);

    const cursor = document.createElement("div");
    cursor.style.position = "absolute"; cursor.style.left = "0%"; cursor.style.top = "0";
    cursor.style.width = "12px"; cursor.style.height = "100%";
    cursor.style.background = "#a3e635"; cursor.style.transform = "translateX(-50%)";
    cursor.style.boxShadow = "0 0 10px #a3e635";
    wrap.appendChild(cursor);

    const valDisp = document.createElement("div");
    valDisp.className = "slider-value"; valDisp.innerText = "0.0";

    const actionBtn = document.createElement("button");
    actionBtn.className = "choice-btn"; actionBtn.innerText = "ストップ！";
    
    const submitBtn = document.createElement("button");
    submitBtn.className = "choice-btn"; submitBtn.innerText = "この数値で確定する";
    submitBtn.style.display = "none"; submitBtn.style.border = "2px solid #38bdf8";

    let pos = 0; let dir = 1; let speed = 1.3; 
    let isMoving = true; let animId; let retryCount = 0; 

    const animate = () => {
      if (!isMoving) return;
      pos += speed * dir;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      cursor.style.left = pos + "%";
      valDisp.innerText = pos.toFixed(1);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate); 

    actionBtn.onclick = () => {
      if (isMoving) {
        isMoving = false; cancelAnimationFrame(animId);
        actionBtn.innerText = "やり直す"; 
        actionBtn.style.background = "rgba(255,255,255,0.1)";
        submitBtn.style.display = "block"; 
      } else {
        isMoving = true; retryCount++;
        actionBtn.innerText = "ストップ！"; 
        actionBtn.style.background = "rgba(56, 189, 248, 0.1)";
        submitBtn.style.display = "none"; 
        animate(); 
      }
    };

    submitBtn.onclick = () => {
      saveHistory();
      const v = parseFloat(pos.toFixed(1));
      const diff = Math.abs(v - 50.0);
      
      let p = 0;
      // ★1. 判定範囲をマイルドに緩和（誤差0.8までは実質50.0と同等として満点！）★
      if (diff <= 0.8) {
        p = qMaxScore; // 満点 (40pt)
      } else if (diff <= 2.5) {
        p = 25; // 誤差2.5%までは部分点 (25pt)
      } else {
        p = 10; // 大きくズレても、とりあえず10ptは保証
      }

      // ★2. みつき考案：努力賞ボーナス（リトライ救済）★
      // ピタリ賞が取れなくても、5回以上やり直して『完璧さへの執着』を示した人には救済点を付与！
      if (retryCount >= 5 && p < qMaxScore) {
        p = Math.min(qMaxScore, p + 15); // 頑張って挑戦した人に＋15点の努力賞！
      }

      // 性格判定スコアの計算も、行動（挑戦回数）に連動させる
      if (diff <= 0.8) { 
        scores.leading += 30; scores.proof += 10; 
      } else if (diff <= 2.5) { 
        scores.normative += 20; 
      } else { 
        // ズレた場合、即諦めた（やり直し1回以下）なら脆弱Ti
        if (retryCount <= 1) {
          scores.vulnerable += 30; scores.ignoring += 10;
        } else {
          // 何回もやったけどダメだった（論理的にやりたいけどできない）なら動員/暗示
          scores.mobilizing += 20; scores.suggestive += 15;
        }
      }

      tiUserPoints += p;
      logAction(`TimingBar:${v.toFixed(1)} (リトライ:${retryCount}回)`, p, qMaxScore);
      next();
    };

    container.appendChild(wrap); container.appendChild(valDisp); 
    container.appendChild(actionBtn); container.appendChild(submitBtn);
  }

  // ------------------------------------------
  // 4. 空間認識：ズレ直し (Q3)
  // ------------------------------------------
// ------------------------------------------
  // 3. 動くタイミングバー (精密制御・やり直し評価版)
  // ------------------------------------------
  else if (type === "timing_bar") {
    const qMaxScore = 40;
    tiMaxPossible += qMaxScore;

    const wrap = document.createElement("div");
    wrap.style.position = "relative"; wrap.style.width = "100%"; wrap.style.height = "45px";
    wrap.style.background = "rgba(0,0,0,0.5)"; wrap.style.border = "2px solid #38bdf8";
    wrap.style.borderRadius = "25px"; wrap.style.margin = "20px 0"; wrap.style.overflow = "hidden";

    const targetLine = document.createElement("div");
    targetLine.style.position = "absolute"; targetLine.style.left = "50%"; targetLine.style.top = "0";
    targetLine.style.width = "4px"; targetLine.style.height = "100%";
    targetLine.style.background = "#f472b6"; targetLine.style.transform = "translateX(-50%)";
    targetLine.style.boxShadow = "0 0 10px #f472b6";
    wrap.appendChild(targetLine);

    const cursor = document.createElement("div");
    cursor.style.position = "absolute"; cursor.style.left = "0%"; cursor.style.top = "0";
    cursor.style.width = "12px"; cursor.style.height = "100%";
    cursor.style.background = "#a3e635"; cursor.style.transform = "translateX(-50%)";
    cursor.style.boxShadow = "0 0 10px #a3e635";
    wrap.appendChild(cursor);

    const valDisp = document.createElement("div");
    valDisp.className = "slider-value"; valDisp.innerText = "0.0";

    const actionBtn = document.createElement("button");
    actionBtn.className = "choice-btn"; actionBtn.innerText = "ストップ！";
    
    const submitBtn = document.createElement("button");
    submitBtn.className = "choice-btn"; submitBtn.innerText = "この数値で確定する";
    submitBtn.style.display = "none"; submitBtn.style.border = "2px solid #38bdf8";

    let pos = 0; let dir = 1; let speed = 1.3; 
    let isMoving = true; let animId; let retryCount = 0; 

    const animate = () => {
      if (!isMoving) return;
      pos += speed * dir;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      cursor.style.left = pos + "%";
      valDisp.innerText = pos.toFixed(1);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate); 

    actionBtn.onclick = () => {
      if (isMoving) {
        isMoving = false; cancelAnimationFrame(animId);
        actionBtn.innerText = "やり直す"; 
        actionBtn.style.background = "rgba(255,255,255,0.1)";
        submitBtn.style.display = "block"; 
      } else {
        isMoving = true; retryCount++;
        actionBtn.innerText = "ストップ！"; 
        actionBtn.style.background = "rgba(56, 189, 248, 0.1)";
        submitBtn.style.display = "none"; 
        animate(); 
      }
    };

    submitBtn.onclick = () => {
      saveHistory();
      const v = parseFloat(pos.toFixed(1));
      const diff = Math.abs(v - 50.0);
      
      let p = 0;
      // ★1. 判定範囲をマイルドに緩和（誤差0.8までは実質50.0と同等として満点！）★
      if (diff <= 0.8) {
        p = qMaxScore; // 満点 (40pt)
      } else if (diff <= 2.5) {
        p = 25; // 誤差2.5%までは部分点 (25pt)
      } else {
        p = 10; // 大きくズレても、とりあえず10ptは保証
      }

      // ★2. みつき考案：努力賞ボーナス（リトライ救済）★
      // ピタリ賞が取れなくても、5回以上やり直して『完璧さへの執着』を示した人には救済点を付与！
      if (retryCount >= 5 && p < qMaxScore) {
        p = Math.min(qMaxScore, p + 15); // 頑張って挑戦した人に＋15点の努力賞！
      }

      // 性格判定スコアの計算も、行動（挑戦回数）に連動させる
      if (diff <= 0.8) { 
        scores.leading += 30; scores.proof += 10; 
      } else if (diff <= 2.5) { 
        scores.normative += 20; 
      } else { 
        // ズレた場合、即諦めた（やり直し1回以下）なら脆弱Ti
        if (retryCount <= 1) {
          scores.vulnerable += 30; scores.ignoring += 10;
        } else {
          // 何回もやったけどダメだった（論理的にやりたいけどできない）なら動員/暗示
          scores.mobilizing += 20; scores.suggestive += 15;
        }
      }

      tiUserPoints += p;
      logAction(`TimingBar:${v.toFixed(1)} (リトライ:${retryCount}回)`, p, qMaxScore);
      next();
    };

    container.appendChild(wrap); container.appendChild(valDisp); 
    container.appendChild(actionBtn); container.appendChild(submitBtn);
  }

  // ------------------------------------------
  // 5. 空間配置：自由ドラッグ (Q7)
  // ------------------------------------------
  else if (type === "align_free") {
    const qMaxScore = 30;
    tiMaxPossible += qMaxScore;
    const area = document.createElement("div"); 
    area.style.height="260px"; area.style.position="relative"; area.style.border="2px dashed #38bdf8"; area.style.background="rgba(0,0,0,0.25)"; area.style.marginBottom="15px";
    const boxes = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("div"); b.className = "align-box"; b.style.position="absolute";
      b.style.top = (i * 45) + "px"; b.style.left = (i * 45) + "px";
      
      // ★ offX, offY を受け取ってズレを打ち消す！
      setupDraggable(b, (x, y, el, target, offX, offY) => {
        const r = area.getBoundingClientRect(); 
        el.style.position = 'absolute';
        // 指で掴んだズレ(offX)を引くことで、置いた場所にピタッと止まる！
        let newLeft = x - r.left - offX;
        let newTop = y - r.top - offY;
        el.style.left = Math.min(Math.max(newLeft, 0), r.width - 50) + "px";
        el.style.top = Math.min(Math.max(newTop, 0), r.height - 50) + "px";
        el.dataset.moved = "true";
        area.appendChild(el);
      });
      area.appendChild(b); boxes.push(b);
    }
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="この配置で確定";
    btn.onclick = () => {
      saveHistory(); let corners = 0; let yC = []; let xC = [];
      boxes.forEach(b => {
        const l = parseInt(b.style.left), t = parseInt(b.style.top); yC.push(t); xC.push(l);
        if ((l < 50 || l > area.offsetWidth - 80) && (t < 50 || t > area.offsetHeight - 80)) corners++;
      });
      
      // X軸、Y軸のバラつきを計算
      const dY = Math.max(...yC) - Math.min(...yC); 
      const dX = Math.max(...xC) - Math.min(...xC);
      
      // ★みつきの画像のような「2x2のグリッド配置」を検知するロジック
      // 座標を近いもの同士でグループ化（クラスター化）して、2行2列になっていれば「補助/創造Ti」
      let uniqueX = xC.sort((a,b)=>a-b).filter((v,i,a) => i===0 || v - a[i-1] > 20).length;
      let uniqueY = yC.sort((a,b)=>a-b).filter((v,i,a) => i===0 || v - a[i-1] > 20).length;
      let isGrid = (uniqueX === 2 && uniqueY === 2);
      
      let isAligned = (dY < 20 || dX < 20); // 1列に綺麗に並べた場合
      
      let p = 0; let msg = "";
      if (isAligned) { p = qMaxScore; msg = "一列整列(主導Ti)"; scores.leading += 25; }
      else if (isGrid) { p = qMaxScore; msg = "グリッド配置(創造Ti)"; scores.creative += 25; scores.proof += 10; }
      else if (corners >= 3) { p = qMaxScore; msg = "四隅支配(Se)"; seFlag = true; scores.creative += 10; }
      else { p = 10; msg = "適当な配置"; scores.vulnerable += 20; }
      
      tiUserPoints += p; logAction(msg, p, qMaxScore); next();
    };
    container.appendChild(area); container.appendChild(btn);
  }
  // ------------------------------------------
  // 6. 二重分類 (Q6)
  // ------------------------------------------
  else if (type === "classification") {
    const qMaxScore = 40;
    tiMaxPossible += qMaxScore;
    const wrap = document.createElement("div"); wrap.className="folder-wrap";
    const f1 = document.createElement("div"); f1.className="folder"; f1.id="v-folder"; f1.innerHTML="<b>野菜</b>";
    const f2 = document.createElement("div"); f2.className="folder"; f2.id="f-folder"; f2.innerHTML="<b>果物</b>";
    const pool = document.createElement("div"); pool.id="item-pool"; pool.style.minHeight="70px"; pool.style.border="1px solid #38bdf8"; pool.style.padding="10px"; pool.style.margin="15px 0"; pool.style.display="flex"; pool.style.gap="8px"; pool.style.flexWrap="wrap";
    
    ["トマト", "スイカ", "アボカド", "イチゴ"].forEach(txt => {
      const it = document.createElement("div"); it.className="draggable-item"; it.innerText=txt;
      setupDraggable(it, (x, y, el, target) => {
        if (target && target.closest("#v-folder")) f1.appendChild(el);
        else if (target && target.closest("#f-folder")) f2.appendChild(el);
        else pool.appendChild(el);
        el.style.position="static";
      });
      pool.appendChild(it);
    });
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="分類を終了";
    btn.onclick = () => {
      saveHistory();
      const moved = f1.children.length + f2.children.length - 2;
      let p = (moved > 0) ? qMaxScore : 0;
      if (p === qMaxScore) scores.leading += 25; else scores.vulnerable += 30;
      tiUserPoints += p;
      logAction("仕分け完了", p, qMaxScore);
      next();
    };
    wrap.appendChild(f1); wrap.appendChild(f2); container.appendChild(wrap); container.appendChild(pool); container.appendChild(btn);
  }

  // ------------------------------------------
  // 7. 境界線 (Q9)
  // ------------------------------------------
  else if (type === "black_white_boundary") {
    const qMaxScore = 35;
    tiMaxPossible += qMaxScore;
    const bar = document.createElement("div"); bar.className="gradient-bar";
    const handle = document.createElement("div"); handle.className="boundary-handle"; handle.style.left="5%"; bar.appendChild(handle);
    let isClicked = false;
    handle.onmousedown = handle.ontouchstart = (e) => { 
      isClicked = true;
      const move = (me) => {
        const mx = me.touches ? me.touches[0].clientX : me.clientX;
        const r = bar.getBoundingClientRect();
        let p = mx - r.left; if(p<0)p=0; if(p>r.width)p=r.width;
        handle.style.left = p + "px"; handle.dataset.val = (p/r.width)*100;
      };
      const stop = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", stop); document.removeEventListener("touchmove", move); document.removeEventListener("touchend", stop); };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", stop); document.addEventListener("touchmove", move, {passive:false}); document.addEventListener("touchend", stop);
    };
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="境界を確定";
    btn.onclick = () => {
      saveHistory();
      let v = parseFloat(handle.dataset.val || 5);
      let p = (isClicked && v > 89) ? qMaxScore : 10;
      if (v > 89) { scores.leading += 30; scores.proof += 15; } else { scores.normative += 25; }
      tiUserPoints += p;
      logAction(`B-Line:${v.toFixed(1)}%`, p, qMaxScore);
      next();
    };
    container.appendChild(bar); container.appendChild(btn);
  }

  // ------------------------------------------
  // 8. 説明書 (Q12)
  // ------------------------------------------
  else if (type === "manual_gimmick") {
    const qMaxScore = 50;
    tiMaxPossible += qMaxScore;
    const mBox = document.createElement("div"); mBox.style.fontSize="0.75rem"; mBox.style.background="rgba(0,0,0,0.4)"; mBox.style.padding="10px"; mBox.style.border="1px solid #38bdf8"; mBox.style.textAlign="left";
    mBox.innerHTML = q.manual_text; container.appendChild(mBox);
    const pList = document.createElement("div"); pList.style.display="flex"; pList.style.flexDirection="column"; pList.style.gap="8px"; pList.style.margin="15px 0";
    let order = 1;
    q.steps.forEach(s => {
      const btn = document.createElement("div"); btn.className="choice-btn"; btn.style.textAlign="left"; btn.style.position="relative"; btn.innerText = s.text;
      btn.onclick = () => {
        if(btn.dataset.order){
          btn.dataset.order = ""; btn.classList.remove("btn-active"); btn.querySelector(".badge-order").remove(); order--;
        } else {
          btn.dataset.order = order; btn.classList.add("btn-active");
          const bg = document.createElement("span"); bg.className="badge-order"; bg.innerText = order;
          btn.appendChild(bg); order++;
        }
      };
      pList.appendChild(btn);
    });
    const go = document.createElement("button"); go.className="choice-btn"; go.innerText="この手順で実行";
    go.onclick = () => {
      saveHistory();
      const first = Array.from(pList.children).find(el => el.dataset.order === "1");
      let p = (first && first.innerText.includes("フィルム")) ? qMaxScore : 0;
      if (p === qMaxScore) { scores.leading += 30; scores.proof += 20; } else { scores.vulnerable += 40; }
      tiUserPoints += p;
      logAction("Manual", p, qMaxScore);
      next();
    };
    container.appendChild(pList); container.appendChild(go);
  }

  // ------------------------------------------
  // 9. 文章修正デバッグ (Q19)
  // ------------------------------------------
  else if (type === "text_debug") {
    const qMaxScore = 40; tiMaxPossible += qMaxScore;
    const desc = document.createElement("p"); desc.style.fontSize="0.85rem"; desc.style.textAlign="left";
    desc.innerHTML = "<b>※指示：</b> 「80％の人がAと回答しました。よってAが多数派です」<br>この主張の論理的欠陥を指摘してください。"; container.appendChild(desc);
    
    const input = document.createElement("textarea"); input.className="feedback-input"; input.placeholder="理由を記述してください...";
    container.appendChild(input);
    
    const fixBtn = document.createElement("button"); fixBtn.className="choice-btn"; fixBtn.innerText="回答を提出";
fixBtn.onclick = () => {
      saveHistory(); 
      let val = input.value.trim();
      let p = 0; let msg = "";
      
      // ★みつきの分析通り、Ne的な「他・選択肢・可能性」は創造Ti(creative)へ変更！
      const leadingKeywords = ["母数", "矛盾",  "全体", "分母", "前提", "対象", "標本", "サンプリング", "バイアス", "偏り", "割合", "有効", "代表性", "定義"];
      const creativeKeywords = ["他", "選択肢", "可能性", "確率", "選択", "状況", "ケース"];
      const proofKeywords = ["欠陥", "破綻", "飛躍", "事実", "根拠", "極端", "限定"];
      const normativeKeywords = ["普通", "一般", "常識", "多数", "多い"];

      if (leadingKeywords.some(kw => val.includes(kw))) {
        p = qMaxScore; scores.leading += 30; msg = "主導Ti";
      } else if (creativeKeywords.some(kw => val.includes(kw))) {
        p = qMaxScore; scores.creative += 30; msg = "創造Ti"; // ★他、選択肢、可能性は創造Ti！
      } else if (proofKeywords.some(kw => val.includes(kw))) {
        p = qMaxScore; scores.proof += 30; msg = "証明Ti";   // ★証明Tiは批判・バグ指摘
      } else if (normativeKeywords.some(kw => val.includes(kw))) {
        p = 15; scores.normative += 15; msg = "規範Ti";
      } else if (val.length < 5) {
        p = 0; scores.vulnerable += 20; msg = "脆弱Ti";
      } else {
        p = 15; scores.normative += 15; msg = "一般回答(規範Ti)";
      }
      
      tiUserPoints += p;
      logAction(`デバッグ:「${val}」と記述 (${msg})`, p, qMaxScore); 
      next();
    };
    container.appendChild(fixBtn);
  }

  // ------------------------------------------
  // 10. 情報の木 (Q13)
  // ------------------------------------------
  else if (type === "logic_tree") {
    const qMaxScore = 35;
    tiMaxPossible += qMaxScore;
    const treeF = document.createElement("div"); treeF.className="folder"; treeF.style.width="95%"; treeF.innerHTML="<b>食べ物</b>";
    const treeP = document.createElement("div"); treeP.style.padding="10px"; treeP.style.display="flex"; treeP.style.gap="8px"; treeP.style.flexWrap="wrap";
    ["いちご","トマト","草","耳のキノコ","脇のもやし"].forEach(tx => {
      const item = document.createElement("div"); item.className="draggable-item"; item.innerText=tx;
      setupDraggable(item, (x,y,el,target) => {
        if(target && target.closest(".folder")) treeF.appendChild(el); else treeP.appendChild(el);
        el.style.position="static";
      });
      treeP.appendChild(item);
    });
    const ok = document.createElement("button"); ok.className="choice-btn"; ok.innerText="確定";
    ok.onclick = () => {
      saveHistory();
      const inFolder = Array.from(treeF.querySelectorAll('.draggable-item')).map(el => el.innerText);
      let p = 0; let msg = "";
      if (inFolder.length === 2 && inFolder.includes("いちご") && inFolder.includes("トマト")) {
        scores.leading += 30; p = qMaxScore; msg = "厳密分類(主導Ti)";
      } else if (inFolder.includes("耳のキノコ") || inFolder.includes("脇のもやし")) {
        scores.creative += 30; p = qMaxScore; msg = "創造分類(創造Ti)";
      } else {
        scores.vulnerable += 30; p = 10; msg = "不完全分類";
      }
      tiUserPoints += p;
      logAction(msg, p, qMaxScore);
      next();
    };
    container.appendChild(treeF); container.appendChild(treeP); container.appendChild(ok);
  }

  // ------------------------------------------
  // 11. 創造Tiギミック (Q20)
  // ------------------------------------------
  else if (type === "creative_ti_gimmick") {
    const qMaxScore = 30;
    tiMaxPossible += qMaxScore;
    const slot = document.createElement("div"); slot.className="folder"; slot.id="exp-slot"; slot.style.width="95%"; slot.style.minHeight="80px"; slot.innerHTML="<b>【説明スロット(2つまで)】</b>";
    const pArea = document.createElement("div"); pArea.style.display="flex"; pArea.style.flexDirection="column"; pArea.style.gap="5px"; pArea.style.margin="10px 0";
    q.blocks.forEach(b => {
      const item = document.createElement("div"); item.className="draggable-item"; item.style.display="block"; item.innerText=b.text; item.dataset.id = b.id;
      setupDraggable(item, (x,y,el,target) => {
        const currentInSlot = slot.querySelectorAll(".draggable-item").length;
        if(target && target.closest("#exp-slot") && currentInSlot < 2) slot.appendChild(el); else pArea.appendChild(el);
        el.style.position="static";
      });
      pArea.appendChild(item);
    });
    const finish = document.createElement("button"); finish.className="choice-btn"; finish.innerText="これで説明する";
    finish.onclick = () => {
      saveHistory();
      const ids = Array.from(slot.querySelectorAll(".draggable-item")).map(el => el.dataset.id);
      let p = 0;
      if (ids.includes("B") || ids.includes("C") || ids.includes("D")) {
        scores.creative += 35; p = qMaxScore; logAction("創造的説明", p, qMaxScore);
      } else {
        scores.leading += 25; p = 20; logAction("主導的説明", p, qMaxScore);
      }
      tiUserPoints += p;
      next();
    };
    container.appendChild(slot); container.appendChild(pArea); container.appendChild(finish);
  }

  // ------------------------------------------
  // 12. パラドックス (Q15) & ルール適用 (Q16)
  // ------------------------------------------
  else if (type === "paradox_gimmick") {
    const qMaxScore = 40;
    tiMaxPossible += qMaxScore;
    q.rules.forEach(r => {
      const rb = document.createElement("button"); rb.className="choice-btn"; rb.innerText=r.text;
      rb.onclick = () => {
        saveHistory();
        let p = (r.id === "C") ? qMaxScore : 0;
        if(p === qMaxScore) scores.proof += 35; else scores.vulnerable += 40;
        tiUserPoints += p;
        logAction(`Paradox:${r.id}`, p, qMaxScore);
        next();
      };
      container.appendChild(rb);
    });
  }
  else if (type === "rule_application") {
    const qMaxScore = 45;
    tiMaxPossible += qMaxScore;
    const w = document.createElement("div"); w.style.display="flex"; w.style.flexWrap="wrap"; w.style.gap="10px";
    ["A","B","C","D"].forEach(l => {
      const box = document.createElement("div"); box.className="folder"; box.id="b-"+l; box.style.width="45%"; box.style.minHeight="60px"; box.innerHTML=`<b>BOX ${l}</b>`;
      w.appendChild(box);
    });
    const obj = document.createElement("div"); obj.className="draggable-item"; obj.innerText="青くて四角い物体";
    setupDraggable(obj, (x,y,el,target) => {
      const box = target ? target.closest(".folder") : null;
      if(box) { box.appendChild(el); el.style.position="static"; }
    });
    container.appendChild(obj); container.appendChild(w);
    const b = document.createElement("button"); b.className="choice-btn"; b.innerText="適用完了";
    b.onclick = () => {
      saveHistory();
      const isOk = document.getElementById("b-D").querySelector(".draggable-item");
      let p = isOk ? qMaxScore : 0;
      if(isOk) { scores.proof += 40; scores.leading += 10; } else { scores.vulnerable += 40; }
      tiUserPoints += p;
      logAction(isOk?"Rule:OK":"Rule:NG", p, qMaxScore);
      next();
    };
    container.appendChild(b);
  }

  // --- 共通フッター ---
  const footer = document.createElement("div");
  footer.style.marginTop = "25px"; footer.style.display = "flex"; footer.style.gap = "10px";

  const backBtn = document.createElement("button");
  backBtn.className = "choice-btn"; backBtn.style.flex = "1"; backBtn.style.background = "rgba(255,255,255,0.05)";
  backBtn.innerHTML = "<i class='fa-solid fa-arrow-left'></i> 戻る";
  backBtn.onclick = goBack;
  if (history.length === 0) backBtn.style.opacity = "0.3";

  const skipBtn = document.createElement("button");
  skipBtn.className = "choice-btn"; skipBtn.style.flex = "2"; skipBtn.style.background = "rgba(100,116,139,0.2)";
  skipBtn.innerHTML = "判定不能 / スキップ";
    skipBtn.onclick = () => {
    saveHistory();
    tiMaxPossible += 10; // スキップした分も少しだけ分母に足す
    scores.vulnerable += 15; // 40から15へマイルドに
    logAction("Skip", 0, 10); 
    next(); 
  };

  footer.appendChild(backBtn);
  footer.appendChild(skipBtn);
  container.appendChild(footer);
}

function next() { currentQ++; renderQuestion(); }

function showResult() {
  showScreen("result-screen");
  const res = document.getElementById("result-screen");
  const selfId = document.getElementById("self-id").value || "未登録研究員";

// 1. Ti強度を先に計算
  let str = Math.min(100, Math.floor((tiUserPoints / tiMaxPossible) * 100));
  let finalScores = { ...scores };

  // ★【みつき提案：脆弱回答ペナルティの累積化】★
  // 脆弱回答（vulnerable）を選んだ回数（textChoiceCounts.vulnerable）× 5% を強度から引き算する
  if (textChoiceCounts.vulnerable > 0) {
    let penalty = textChoiceCounts.vulnerable * 5; // 選ぶたびに -5%
    str = Math.max(0, str - penalty);
    actionLog.push(`[強度補正] 脆弱回答を${textChoiceCounts.vulnerable}回選択したため強度を -${penalty}%`);
  }

  // ★【みつき定義：階層別のコンボ（2回以上の選択）を検出するヘルパー】★
  // スコア競争に負けがちな mid-tier 機能たちを、テキストの選択回数（コンボ）で優先救済する
  function getComboFunc(targetList) {
    let bestFunc = null;
    let maxCount = 1; // 2回以上選んでいることをコンボの条件とする
    
    for (let f of targetList) {
      let count = textChoiceCounts[f] || 0;
      if (count > maxCount) {
        maxCount = count;
        bestFunc = f;
      } else if (count === maxCount && maxCount > 1) {
        // コンボ回数が同じ場合は、純粋な得点（scores）が高い方を優先する
        if (bestFunc && scores[f] > scores[bestFunc]) {
          bestFunc = f;
        }
      }
    }
    return bestFunc;
  }

  // ----------------------------------------------------
  // ★【みつき定義：階層別 ＆ 証明・脆弱コンボ除外判定マトリックス】★
  // ----------------------------------------------------
  let high = "vulnerable"; // デフォルト

  if (str >= 90) {
    // 【神の領域 (90%以上)】問答無用で主導Ti
    high = "leading";
  } 
  else if (str >= 80) {
    // 【強者帯 (80%〜89%)】主導Ti か 証明Ti （証明はコンボから除外）
    high = (finalScores.proof >= finalScores.leading - 60) ? "proof" : "leading";
  } 
  else if (str >= 70) {
    // 【中堅上位帯 (70%〜79%)】証明、創造、規範、無視
    // 証明は出やすいためコンボから除外！対象は「創造」「規範」「無視」のみ
    const comboTargets = ["creative", "normative", "ignoring"];
    const comboResult = getComboFunc(comboTargets);
    
    if (comboResult) {
      high = comboResult;
      actionLog.push(`[判定補正] 中堅上位の価値観コンボ(${comboResult})を最優先反映。`);
    } else {
      // コンボがない場合は、証明含む4者スコア比較
      const c = { 
        proof: finalScores.proof, 
        creative: finalScores.creative, 
        normative: finalScores.normative, 
        ignoring: finalScores.ignoring 
      };
      high = Object.keys(c).reduce((a, b) => c[a] > c[b] ? a : b);
    }
  } 
  else {
    // 【中堅〜下位帯 (70%未満)】暗示、動員、脆弱、規範（★みつきの指示通り規範を追加！）
    // 脆弱はコンボから除外！対象は「暗示」「動員」「規範」のみ
    const comboTargets = ["suggestive", "mobilizing", "normative"];
    const comboResult = getComboFunc(comboTargets);
    
    if (comboResult) {
      high = comboResult;
      actionLog.push(`[判定補正] 中堅下位の価値観コンボ(${comboResult})を最優先反映。`);
    } else {
      // コンボがない場合は、脆弱含む4者スコア比較
      const c = { 
        suggestive: finalScores.suggestive, 
        mobilizing: finalScores.mobilizing, 
        vulnerable: finalScores.vulnerable, 
        normative: finalScores.normative 
      };
      high = Object.keys(c).reduce((a, b) => c[a] > c[b] ? a : b);
    }
  }

  const map = { leading: "主導Ti (LII/LSI)", creative: "創造Ti (ILE/SLE)", normative: "規範Ti (ESI/EII)", vulnerable: "脆弱Ti (SEE/IEE)", suggestive: "暗示Ti (ESE/EIE)", proof: "証明Ti (ILI/SLI)", mobilizing: "動員Ti (SEI/IEI)", ignoring: "無視Ti (LIE/LSE)" };

  let dSpeech = "";
  if (seFlag) dSpeech = darlingResultQuotes.se[Math.floor(Math.random() * darlingResultQuotes.se.length)];
  else if (str >= 80) dSpeech = darlingResultQuotes.high[Math.floor(Math.random() * darlingResultQuotes.high.length)];
  else if (str >= 50) dSpeech = darlingResultQuotes.mid[Math.floor(Math.random() * darlingResultQuotes.mid.length)];
  else dSpeech = darlingResultQuotes.low[Math.floor(Math.random() * darlingResultQuotes.low.length)];

  let logHtml = "<div data-html2canvas-ignore='true' style='font-size:0.65rem; color:#94a3b8; height:120px; overflow-y:scroll; border:1px solid #475569; padding:10px; margin-top:20px; background:rgba(0,0,0,0.3); text-align:left;'><strong>[ログ]</strong><br>";
  actionLog.forEach(l => logHtml += `<div style='border-bottom:1px solid #334155; padding:2px;'>${l}</div>`);
  logHtml += "</div>";

  res.innerHTML = `
    <h2>RESEARCH COMPLETED</h2>
    <div style="font-size: 3.8rem; color: #38bdf8; font-weight:bold; margin: 10px 0; text-shadow:0 0 15px rgba(56,189,248,0.5);">${str}%</div>
    <p style="font-size:1.2rem;">推定配置: <strong style="border-bottom:2px solid #38bdf8;">${map[high]}</strong></p>
    <div style="text-align:left; background:rgba(255,255,255,0.08); padding:20px; border-radius:15px; margin-top:20px; font-size:0.85rem; line-height:1.7;">
      ${seFlag ? "<p style='color:#ff4d4d; font-weight:bold;'>【ALERT】Se衝動検知。</p>" : "<p style='color:#a3e635;'>【REPORT】芋虫生存。</p>"}
      <strong>ダーリンちゃん(ILI)の毒言:</strong><br>
      <i style="color:#f472b6;">「${dSpeech}」</i>
      ${logHtml}
    </div>
    
    <!-- フィードバック送信フォーム -->
    <div data-html2canvas-ignore="true" style="margin-top:20px; background:rgba(0,0,0,0.3); padding:15px; border-radius:10px;">
      <p style="font-size:0.8rem; color:#38bdf8; margin-bottom:5px;">💡 開発者へのフィードバック / 深掘り理由</p>
      <textarea id="feedback-text" class="feedback-input" placeholder="例：〇〇の問題は△△の理由で選びました。文句・感想歓迎！"></textarea>
      <button id="send-feedback-btn" class="choice-btn" style="padding:10px; font-size:0.85rem;">フィードバックを送信</button>
    </div>

    <div class="result-actions" data-html2canvas-ignore="true">
      <button id="save-img-btn" class="action-btn"><i class="fa-solid fa-camera"></i> 保存</button>
      <button id="share-btn" class="action-btn"><i class="fa-solid fa-share-nodes"></i> 共有</button>
      <button id="copy-log-btn" class="action-btn"><i class="fa-solid fa-clipboard"></i> コピー</button>
    </div>
    <button class="choice-btn" data-html2canvas-ignore="true" style="margin-top:20px; border:2px solid #38bdf8;" onclick="location.reload()">再試行</button>
  `;

  // ★GASへの送信にフィードバックを追加★
  const sendData = { selfId: selfId, strength: str, resultType: map[high], actionLog: actionLog };
  
  if (GAS_URL_MAIL && GAS_URL_MAIL.startsWith("http")) {
    fetch(GAS_URL_MAIL, { method: 'POST', body: JSON.stringify(sendData), headers: { 'Content-Type': 'application/json' }, mode: 'no-cors' }).catch(e => console.log(e));
  }
  if (GAS_URL_SHEET && GAS_URL_SHEET.startsWith("http")) {
    fetch(GAS_URL_SHEET, { method: 'POST', body: JSON.stringify(sendData), headers: { 'Content-Type': 'application/json' }, mode: 'no-cors' }).catch(e => console.log(e));
  }

  // --- フィードバック送信（トースト対応 ＆ 二刀流送信） ---
  document.getElementById('send-feedback-btn').onclick = () => {
    const fbText = document.getElementById('feedback-text').value;
    if (!fbText) return showToast("テキストを入力してください。");
    
    const fbData = { ...sendData, feedback: fbText };
    
    if (GAS_URL_MAIL && GAS_URL_MAIL.startsWith("http")) {
      fetch(GAS_URL_MAIL, { method: 'POST', body: JSON.stringify(fbData), headers: { 'Content-Type': 'application/json' }, mode: 'no-cors' });
    }
    if (GAS_URL_SHEET && GAS_URL_SHEET.startsWith("http")) {
      fetch(GAS_URL_SHEET, { method: 'POST', body: JSON.stringify(fbData), headers: { 'Content-Type': 'application/json' }, mode: 'no-cors' });
    }
    
    showToast("フィードバックを送信しました！");
    document.getElementById('feedback-text').value = "";
  };
  // 画像保存
  document.getElementById('save-img-btn').onclick = () => {
    html2canvas(document.querySelector('.glass-container'), {backgroundColor: '#0f172a'}).then(canvas => {
      let link = document.createElement('a'); link.download = 'ti-checker-result.png'; link.href = canvas.toDataURL(); link.click();
    });
  };
  
  // シェア
  document.getElementById('share-btn').onclick = () => {
    if (navigator.share) {
      navigator.share({ 
        title: 'ソシオTi強度チェッカー', 
        // text内にURLを含めない（urlプロパティに任せる）
        text: `【論理研究室】\n私のTi強度は${str}%、推定配置は【${map[high]}】でした！\n#ソシオTi強度チェッカー #ソシオニクス`, 
        url: window.location.href 
      });
    } else { 
      alert("お使いのブラウザは共有機能に対応していません。"); 
    }
  };
  
  // ログコピー
  document.getElementById('copy-log-btn').onclick = () => {
    navigator.clipboard.writeText("【システム詳細ログ】\n" + actionLog.join("\n")).then(() => { 
      showToast("詳細ログをコピーしました！"); // alertからshowToastに変更！
    });
  };
}
