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
  if (typeof questions === 'undefined') return alert("data.jsが読み込まれていません");
  questionOrder = [...Array(questions.length).keys()].sort(() => Math.random() - 0.5);
  currentQ = 0; tiUserPoints = 0; tiMaxPossible = 0; actionLog = []; history = [];
  scores = { leading:0, creative:0, normative:0, vulnerable:0, suggestive:0, proof:0, mobilizing:0, ignoring:0 };
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
  else if (["choice", "time_trap", "strawberry_logic", "emotion_logic", "unresolved_logic", "diogenes_trap", "suggestive_ti", "ti_valued_check", "mobilizing_ti_gimmick"].includes(type)) {
    
    // 【較正】主導(leading)の選択肢が持っている点数を、この問題の「真の満点」とする
    const leadingOption = q.choices.find(c => c.func === "leading");
    const qMaxScore = leadingOption ? leadingOption.score : 40; 
    
    const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
    shuffled.forEach(c => {
      const btn = document.createElement("button");
      btn.className = "choice-btn"; btn.innerText = c.text;
      btn.onclick = () => {
        saveHistory();
        tiMaxPossible += qMaxScore; // 分母には「主導Tiの点数」を足す
        
        const elapsed = Date.now() - questionStartTime;
        if (elapsed < 1200) { scores.vulnerable += 25; scores.leading -= 15; }

        scores[c.func] += c.score;
        
        // 主導・証明なら問答無用でその問題の満点を与える（端数切り捨て防止）
        let addedPoints = 0;
        if (c.func === "leading" || c.func === "proof") {
          addedPoints = qMaxScore;
        } else {
          addedPoints = c.score * (tiStrengthWeights[c.func] || 0.1);
        }
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
  else if (type === "slider") {
    const qMaxScore = 40;
    tiMaxPossible += qMaxScore;
    const sli = document.createElement("input"); sli.type="range"; sli.min="0"; sli.max="100"; sli.step="0.1"; sli.value="15";
    const valDisp = document.createElement("div"); valDisp.className="slider-value"; valDisp.innerText="15.0";
    sli.oninput = (e) => valDisp.innerText = parseFloat(e.target.value).toFixed(1);
    
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="値を確定";
    btn.onclick = () => {
      saveHistory();
      const v = parseFloat(sli.value);
      let p = (v === 50.0) ? qMaxScore : (Math.abs(v - 50) <= 1.0 ? 20 : 0);
      
      if (v === 50.0) { 
        scores.leading += 30; 
      } else if (p > 0) { 
        scores.normative += 20; 
      } else { 
        scores.vulnerable += 30; 
      }

      tiUserPoints += p;
      logAction(`Slider:${v}`, p, qMaxScore);
      next();
    };
    container.appendChild(sli); container.appendChild(valDisp); container.appendChild(btn);
  }

  // ------------------------------------------
  // 4. 空間認識：ズレ直し (Q3)
  // ------------------------------------------
  else if (type === "align_fix") {
    const qMaxScore = 30;
    tiMaxPossible += qMaxScore;
    const wrap = document.createElement("div"); wrap.style.display="flex"; wrap.style.justifyContent="center"; wrap.style.gap="15px"; wrap.style.margin="25px 0";
    let isFixed = false;
    for (let i = 0; i < 4; i++) {
      const b = document.createElement("div"); b.className = "align-box";
      if (i === 2) {
        b.classList.add("misaligned");
        b.onclick = () => { b.classList.remove("misaligned"); b.style.boxShadow="0 0 15px #38bdf8"; isFixed = true; };
      }
      wrap.appendChild(b);
    }
    const btn = document.createElement("button"); btn.className="choice-btn"; btn.innerText="次へ";
    btn.onclick = () => {
      saveHistory();
      let p = isFixed ? qMaxScore : 0;
      if (isFixed) { 
        scores.leading += 25; 
      } else { 
        scores.vulnerable += 30; 
      }
      tiUserPoints += p;
      logAction(isFixed?"ズレ修正":"放置", p, qMaxScore);
      next();
    };
    container.appendChild(wrap); container.appendChild(btn);
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
      
      // ★キーワードを大幅に追加★
      const leadingKeywords = ["母数", "全体", "分母", "前提", "対象", "標本", "バイアス", "偏り", "割合", "有効", "代表性", "定義"];
      const proofKeywords = ["他", "選択肢", "条件", "以外"];

      if (leadingKeywords.some(kw => val.includes(kw))) {
        p = qMaxScore; scores.leading += 30; msg = "前提・統計的欠陥を指摘(主導Ti)";
      } else if (proofKeywords.some(kw => val.includes(kw))) {
        p = qMaxScore; scores.proof += 25; scores.creative += 15; msg = "変数の抜けを指摘(証明/創造Ti)";
      } else if (val.length < 5) {
        p = 0; scores.vulnerable += 20; msg = "思考放棄(脆弱Ti)";
      } else {
        p = 15; scores.normative += 15; msg = "一般的な回答(規範Ti)";
      }
      
      tiUserPoints += p; logAction(msg, p, qMaxScore); next();
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

  let str = Math.min(100, Math.floor((tiUserPoints / tiMaxPossible) * 100));
  let finalScores = { ...scores };

  // ★ペナルティを -15% に緩和★
  if (scores.vulnerable > 0) {
    let penalty = Math.min(7, Math.floor(scores.vulnerable * 0.3));
    str = Math.max(0, str - penalty);
    if (penalty > 0) actionLog.push(`[強度補正] 脆弱回答により -${penalty}%`);
  }

  // 判定ロジック
  let high = "vulnerable";

  if (str >= 90) {
    // 【神の領域 (90%以上)】問答無用で主導Ti
    high = "leading";
  } else if (str >= 80) {
    // 【強者帯 (80%〜89%)】主導Ti か 証明Ti
    high = (finalScores.proof >= finalScores.leading - 60) ? "proof" : "leading";
  } else if (str >= 70) {
    // 【中堅上位帯 (70%〜79%)】証明、創造、規範、無視のいずれか
    const c = { 
      proof: finalScores.proof, 
      creative: finalScores.creative, 
      normative: finalScores.normative, 
      ignoring: finalScores.ignoring 
    };
    high = Object.keys(c).reduce((a, b) => c[a] > c[b] ? a : b);
  } else {
    // 【中堅〜下位帯 (70%未満)】テキストで選んだ「価値観」を優先
    // ★ 脆弱(vulnerable)をある程度選んでいたら、最優先で脆弱Tiにする！ ★
    if (finalScores.vulnerable >= 15) { 
      high = "vulnerable"; 
    } else if (finalScores.mobilizing >= 40) { 
      high = "mobilizing"; 
    } else if (finalScores.suggestive >= 40) { 
      high = "suggestive"; 
    } else {
      const c = { creative: finalScores.creative, normative: finalScores.normative, ignoring: finalScores.ignoring, vulnerable: finalScores.vulnerable };
      high = Object.keys(c).reduce((a, b) => c[a] > c[b] ? a : b);
    }
  }

  // ★【Se衝動（芋虫破壊・四隅）の絶対的優先】★
  // 進行中にSeFlagが立っていた場合（結果画面での破壊は除くw）、
  // 強度に関わらず、主導Ti(LII/LSI)はありえないとして強制上書き！
  if (seFlag) {
    if (str >= 60) {
      high = "creative"; // SLEなど
      actionLog.push(`[判定補正] 破壊的Se衝動を検知したため創造Tiを優先。`);
    } else {
      high = "vulnerable"; // SEEなど
      actionLog.push(`[判定補正] 破壊的Se衝動かつ低強度のため脆弱Tiを優先。`);
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
