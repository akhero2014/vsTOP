/* render-records-extra.js — これまでの記録：選択集計（PDF出力含む）・CSV出力・ランキングタブ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function statsForSelectedMatches(teamName, matchIds){
  const matches = matchesInvolvingTeamName(teamName).filter(m=>matchIds.includes(m.id));
  const eventGroups = matches.map(m=>{
    const side = sideForTeamInMatch(m, teamName);
    return side ? m.rallyLog.filter(e=>e.team===side) : [];
  });
  return { matches, players: detailedStatsForAllPlayersFromMatches(eventGroups) };
}

function toggleSelectedAggregateMatch(id){
  if (!state.selectedAggregateMatchIds) state.selectedAggregateMatchIds = [];
  const idx = state.selectedAggregateMatchIds.indexOf(id);
  if (idx>=0) state.selectedAggregateMatchIds.splice(idx,1);
  else state.selectedAggregateMatchIds.push(id);
  render();
}

function renderSelectedAggregateTab(teamName){
  if (!state.selectedAggregateMatchIds) state.selectedAggregateMatchIds = [];
  const matches = matchesInvolvingTeamName(teamName);
  const ids = state.selectedAggregateMatchIds;

  let html = `<p class="muted">集計したい試合を自由に選んでください（例：今日の試合だけ、特定の大会だけ、など）。</p>`;
  html += matches.map(m=>{
    const label = m.id==='current' ? '進行中：'+m.homeTeamName+' vs '+m.awayTeamName
      : new Date(m.date).toLocaleDateString('ja-JP')+' '+m.homeTeamName+' vs '+m.awayTeamName;
    const checked = ids.includes(m.id);
    return `
    <label class="row gap8" style="padding:8px 0;border-bottom:1px solid var(--line);">
      <input type="checkbox" ${checked?'checked':''} onchange="toggleSelectedAggregateMatch('${m.id}')"> ${esc(label)}
    </label>`;
  }).join('') || '<p class="muted">まだ試合記録がありません</p>';

  if (ids.length>0){
    const { matches:selMatches, players } = statsForSelectedMatches(teamName, ids);
    const agg = aggregateFromPlayerList(players);
    let opponentErrors = 0;
    selMatches.forEach(m=>{
      const side = sideForTeamInMatch(m, teamName);
      if (side==='home'){
        opponentErrors += (m.id==='current')
          ? (state.trackOpponentStats ? opponentErrorsBenefiting('home') : state.opponentMistakePoints)
          : (m.homeOpponentErrors||0);
      }
    });
    html += `<h3 style="margin-top:16px;">選択した${ids.length}試合の集計（${esc(teamName)}）</h3>`;
    html += teamAggregateRowsHtml(agg, opponentErrors);
    html += `<p class="muted" style="font-size:12px;background:rgba(59,130,246,.08);padding:8px;border-radius:8px;">ℹ️ インターネットに接続されている場合は、URLの入らないきれいなPDFを直接生成します（初回はフォントの読み込みに時間がかかります）。オフラインの場合、または生成に失敗した場合は、自動的に印刷機能（→「PDFとして保存」）に切り替わります。</p>
    <button class="btn" style="width:100%;margin-bottom:12px;" onclick="exportSelectedAggregatePdf('${teamName.replace(/'/g,"\\'")}')">🖨️ PDFを出力する</button>`;

    if (state.pdfFallbackPrompt && state.pdfFallbackPrompt.teamName===teamName){
      html += `<div class="card" style="margin-bottom:12px;background:rgba(239,68,68,.08);">
        <p>${esc(state.pdfFallbackPrompt.reason)}印刷機能でPDFを作成しますか？</p>
        <div class="row gap8">
          <button class="btn primary" onclick="confirmPdfFallback()">印刷機能で作成する</button>
          <button class="btn" onclick="cancelPdfFallback()">キャンセル</button>
        </div>
      </div>`;
    }
    html += players.length ? statsRowsHtml(players) : '<p class="muted">選手の記録がありません</p>';
  } else {
    html += '<p class="muted" style="margin-top:12px;">試合を選択すると、ここに集計結果が表示されます。</p>';
  }
  return html;
}

/* ==================== PDF生成（オンライン限定：jsPDFと日本語フォントをCDNから取得） ====================
   このPDF機能はブラウザの印刷機能を経由しないため、URL・日付などの余計な表示が入らず、
   横向き・余白・ページ構成を完全にアプリ側で制御できる。その代わりインターネット接続が必須。
   - jsPDF / jspdf-autotable 本体：cdnjsから読み込み（未読み込みの場合のみ）
   - 日本語フォント（Noto Sans JP）：GitHub上のファイルをjsDelivr経由で取得し、
     Cache APIに保存しておくことで2回目以降の生成を高速化する
*/

const PDF_JP_FONT_URL = 'https://cdn.jsdelivr.net/gh/kongou-ae/font@master/NotoSansJP-Regular.ttf';
const PDF_FONT_CACHE_NAME = 'vstop-pdf-font-cache-v1';
const PDF_JSPDF_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
];
const PDF_AUTOTABLE_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.31/dist/jspdf.plugin.autotable.min.js',
];

function loadScriptOnce(src){
  return new Promise((resolve, reject)=>{
    if (document.querySelector('script[data-pdf-src="'+src+'"]')){ resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-pdf-src', src);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('ライブラリの読み込みに失敗しました：'+src));
    document.head.appendChild(s);
  });
}

/// 複数のCDN候補を順番に試し、どれか1つでも読み込めれば成功とする
async function loadScriptWithFallback(urls){
  let lastError = null;
  for (const url of urls){
    try{
      await loadScriptOnce(url);
      return;
    }catch(err){
      console.warn('CDNからの読み込みに失敗、次の候補を試します:', url, err);
      lastError = err;
    }
  }
  throw lastError || new Error('すべてのCDN候補からの読み込みに失敗しました');
}

async function ensurePdfLibrariesLoaded(){
  if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function'){
    await loadScriptWithFallback(PDF_JSPDF_URLS);
  }
  if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function'){
    throw new Error('jsPDFの読み込みに失敗しました（インターネット接続、または広告ブロッカー等の拡張機能をご確認ください）');
  }
  const proto = window.jspdf.jsPDF.prototype;
  if (typeof proto.autoTable !== 'function'){
    await loadScriptWithFallback(PDF_AUTOTABLE_URLS);
  }
  if (typeof proto.autoTable !== 'function'){
    throw new Error('表組みライブラリ（autoTable）の読み込みに失敗しました');
  }
}

function arrayBufferToBase64(buffer){
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i=0; i<bytes.length; i+=chunkSize){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunkSize));
  }
  return btoa(binary);
}

/// 日本語フォントを取得してBase64化する。一度取得できたらCache APIに保存し、
/// 次回以降はネットワークに再度アクセスしなくても済むようにする
async function loadJapaneseFontBase64(){
  if (window.__jpFontBase64) return window.__jpFontBase64;

  let response = null;
  if ('caches' in window){
    try{
      const cache = await caches.open(PDF_FONT_CACHE_NAME);
      response = await cache.match(PDF_JP_FONT_URL);
      if (!response){
        const fetched = await fetch(PDF_JP_FONT_URL);
        if (!fetched.ok) throw new Error('status ' + fetched.status);
        await cache.put(PDF_JP_FONT_URL, fetched.clone());
        response = fetched;
      }
    }catch(e){
      response = null; // キャッシュがダメでも下の直接fetchにフォールバックする
    }
  }
  if (!response){
    response = await fetch(PDF_JP_FONT_URL);
    if (!response.ok) throw new Error('日本語フォントの取得に失敗しました（HTTPステータス ' + response.status + '）');
  }
  const buffer = await response.arrayBuffer();

  // Git LFS管理のファイルだと、実体ではなく数百バイトのポインター情報しか返ってこないことがある。
  // 本物のTTFなら通常1MBを大きく超えるため、極端に小さい場合はここで検知して分かりやすいエラーにする
  if (buffer.byteLength < 100000){
    const text = new TextDecoder().decode(buffer.slice(0, 200));
    console.error('日本語フォントの取得内容が異常に小さいです（' + buffer.byteLength + 'バイト）。内容の先頭：', text);
    throw new Error('日本語フォントの取得に失敗しました（取得先が本物のフォントファイルではない可能性があります。サイズ：' + buffer.byteLength + 'バイト）');
  }

  const base64 = arrayBufferToBase64(buffer);
  window.__jpFontBase64 = base64;
  return base64;
}

/// 選択した試合の集計をPDFとして生成する（jsPDF+autoTableを使い、アプリが自分でPDFを組み立てる）。
/// 1ページ目：チーム全体成績＋スパイク/サーブ/キャッチ（総合・率の高い順）の選手別一覧
/// 続くページ：試合ごとの記録（得点・スタメン・メンバーチェンジ、1ページ5試合・区切り線つき）
/// さらに続くページ：選手ごとに1ページ（記録があるカテゴリのみ、背番号順）
async function generatePdfOnline(teamName){
  const ids = state.selectedAggregateMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }

  showToast('PDFを生成しています…（初回はフォントの読み込みに時間がかかることがあります）');

  await ensurePdfLibrariesLoaded();
  const fontBase64 = await loadJapaneseFontBase64();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
  doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
  doc.setFont('NotoSansJP');

  const { matches, players } = statsForSelectedMatches(teamName, ids);
  const agg = aggregateFromPlayerList(players);
  const tableStyle = { font:'NotoSansJP', fontSize:9 };
  const headStyle = { font:'NotoSansJP', fontStyle:'normal', fillColor:[59,130,246] };
  let firstSection = true;
  const startNewSection = () => { if (!firstSection) doc.addPage(); firstSection = false; };

  // ---- ページ1：チーム全体成績 ----
  startNewSection();
  doc.setFontSize(16);
  doc.text(teamName + '　選択試合の集計', 10, 14);
  doc.setFontSize(10);
  doc.text('対象試合数：' + ids.length + '件　出力日時：' + new Date().toLocaleString('ja-JP'), 10, 20);
  doc.autoTable({
    startY: 26, margin:{left:10,right:10}, styles: tableStyle, headStyles: headStyle,
    head: [['項目', '値']],
    body: [
      ['スパイク決定率', pct(agg.spikeRate)],
      ['サーブ効果率', pct(agg.serveRate)],
      ['キャッチAパス率', pct(agg.catchRate)],
      ['ブロック', String(agg.totalBlocks)],
      ['サーブミス', String(agg.serveMiss)],
      ['スパイクミス', String(agg.spikeMiss)],
      ['被ブロック数', String(agg.spikeBlocked)],
      ['キャッチミス', String(agg.catchMiss)],
    ],
  });

  const spikePlayers = players.filter(p=>p.spikeOverall.total>0)
    .sort((a,b)=>(b.spikeOverall.decisionRate??-1)-(a.spikeOverall.decisionRate??-1));
  if (spikePlayers.length){
    startNewSection();
    doc.setFontSize(14);
    doc.text('スパイク（総合・決定率順）', 10, 14);
    doc.autoTable({
      startY: 20, margin:{left:10,right:10}, styles: tableStyle, headStyles: headStyle,
      head: [['#','選手名','総数','決定','ミス','被ブロック','決定率']],
      body: spikePlayers.map(p=>[p.player.number, p.player.name, p.spikeOverall.total, p.spikeOverall.decided, p.spikeOverall.miss, p.spikeOverall.blocked, pct(p.spikeOverall.decisionRate)]),
    });
  }
  const servePlayers = players.filter(p=>p.serve.total>0)
    .sort((a,b)=>(b.serve.effectiveRate??-1)-(a.serve.effectiveRate??-1));
  if (servePlayers.length){
    startNewSection();
    doc.setFontSize(14);
    doc.text('サーブ（総合・効果率順）', 10, 14);
    doc.autoTable({
      startY: 20, margin:{left:10,right:10}, styles: tableStyle, headStyles: headStyle,
      head: [['#','選手名','総数','決定','効果','ミス','効果率']],
      body: servePlayers.map(p=>[p.player.number, p.player.name, p.serve.total, p.serve.decided, p.serve.effective, p.serve.miss, pct(p.serve.effectiveRate)]),
    });
  }
  const catchPlayers = players.filter(p=>p.serveReceiveOverall.total>0)
    .sort((a,b)=>(b.serveReceiveOverall.aPassRate??-1)-(a.serveReceiveOverall.aPassRate??-1));
  if (catchPlayers.length){
    startNewSection();
    doc.setFontSize(14);
    doc.text('キャッチ（総合・Aパス率順）', 10, 14);
    doc.autoTable({
      startY: 20, margin:{left:10,right:10}, styles: tableStyle, headStyles: headStyle,
      head: [['#','選手名','総数','Aパス','Bパス','Cパス','ミス','Aパス率']],
      body: catchPlayers.map(p=>[p.player.number, p.player.name, p.serveReceiveOverall.total, p.serveReceiveOverall.aPass, p.serveReceiveOverall.bPass, p.serveReceiveOverall.cPass, p.serveReceiveOverall.miss, pct(p.serveReceiveOverall.aPassRate)]),
    });
  }

  // ---- 試合ごとの記録（1ページ5試合、区切り線つき）----
  const validMatches = matches.filter(m=>sideForTeamInMatch(m, teamName));
  const nameForIdIn = (m, id) => {
    const ev = m.rallyLog.find(e=>e.playerId===id);
    return ev ? ev.playerName : '(不明)';
  };
  for (let i=0; i<validMatches.length; i+=5){
    const chunk = validMatches.slice(i, i+5);
    startNewSection();
    doc.setFontSize(14);
    doc.text(i===0 ? '試合ごとの記録' : '試合ごとの記録（続き）', 10, 14);
    let y = 22;
    chunk.forEach((m, idx)=>{
      const side = sideForTeamInMatch(m, teamName);
      const startingLineup = side==='home' ? m.homeStartingLineup : m.awayStartingLineup;
      const scoreText = m.setScores.map(s=>s.home+'-'+s.away).join(' / ');
      if (idx>0){ doc.setDrawColor(180); doc.line(10, y, 287, y); y += 6; }
      doc.setFontSize(11);
      doc.text(m.homeTeamName + ' vs ' + m.awayTeamName + '　' + new Date(m.date).toLocaleDateString('ja-JP'), 10, y); y += 6;
      doc.setFontSize(9);
      doc.text('スコア：' + scoreText, 10, y); y += 5;
      const lineupText = (startingLineup||[]).map(e=>e.position+':'+nameForIdIn(m,e.playerId)).join('　') || '記録なし';
      doc.text(doc.splitTextToSize('スタメン：' + lineupText, 270), 10, y); y += 5 + Math.max(0, doc.splitTextToSize('スタメン：' + lineupText, 270).length-1)*4;
      const subText = (m.substitutedPlayerIds && m.substitutedPlayerIds.length)
        ? 'メンバーチェンジで出場した選手：' + m.substitutedPlayerIds.map(id=>nameForIdIn(m,id)).join('　')
        : 'メンバーチェンジなし';
      doc.text(doc.splitTextToSize(subText, 270), 10, y); y += 8 + Math.max(0, doc.splitTextToSize(subText, 270).length-1)*4;
    });
  }

  // ---- 選手ごとに1ページ（背番号順、記録があるカテゴリのみ）----
  const playersByNumber = players.slice().sort((a,b)=>a.player.number-b.player.number);
  playersByNumber.forEach(p=>{
    startNewSection();
    doc.setFontSize(14);
    doc.text(p.player.name + '（#' + p.player.number + '）', 10, 14);
    doc.setFontSize(9);
    const participationText = p.participationType
      ? '出場形態：' + p.participationType + (p.participationType==='MC' ? '（途中出場）' : '') + '　出場セット数：' + p.setsParticipated
      : '出場セット数：' + p.setsParticipated;
    doc.text(participationText, 10, 20);
    let y = 26;

    const section = (title, head, body) => {
      doc.setFontSize(11);
      doc.text(title, 10, y);
      doc.autoTable({ startY:y+2, margin:{left:10,right:10}, styles: tableStyle, headStyles: headStyle, head:[head], body });
      y = doc.lastAutoTable.finalY + 8;
    };

    if (p.spikeOverall.total>0){
      section('スパイク（総合）', ['総数','決定','ミス','被ブロック','決定率'],
        [[p.spikeOverall.total, p.spikeOverall.decided, p.spikeOverall.miss, p.spikeOverall.blocked, pct(p.spikeOverall.decisionRate)]]);
      if (p.spikeByCombo && p.spikeByCombo.length){
        section('スパイク（コンビ別）', ['コンビ','総数','決定','ミス','被ブロック','決定率'],
          p.spikeByCombo.map(c=>[c.name, c.total, c.decided, c.miss, c.blocked, pct(c.decisionRate)]));
      }
    }
    if (p.serve.total>0){
      section('サーブ（総合）', ['総数','決定','効果','ミス','効果率'],
        [[p.serve.total, p.serve.decided, p.serve.effective, p.serve.miss, pct(p.serve.effectiveRate)]]);
      if (p.serveByType && p.serveByType.length){
        section('サーブ（種類別）', ['種類','総数','決定','効果','ミス','効果率'],
          p.serveByType.map(t=>[t.name, t.total, t.decided, t.effective, t.miss, pct(t.effectiveRate)]));
      }
    }
    if (p.serveReceiveOverall.total>0){
      section('キャッチ（総合）', ['総数','Aパス','Bパス','Cパス','ミス','Aパス率'],
        [[p.serveReceiveOverall.total, p.serveReceiveOverall.aPass, p.serveReceiveOverall.bPass, p.serveReceiveOverall.cPass, p.serveReceiveOverall.miss, pct(p.serveReceiveOverall.aPassRate)]]);
      if (p.serveReceiveByType && p.serveReceiveByType.length){
        section('キャッチ（相手サーブ種類別）', ['相手サーブ種類','総数','Aパス','Bパス','Cパス','ミス','Aパス率'],
          p.serveReceiveByType.map(t=>[t.name, t.total, t.aPass, t.bPass, t.cPass, t.miss, pct(t.aPassRate)]));
      }
    }
    if (p.receiveOverall.total>0){
      section('レシーブ（総合）', ['総数','Aパス','Bパス','Cパス','ミス','Aパス率'],
        [[p.receiveOverall.total, p.receiveOverall.aPass, p.receiveOverall.bPass, p.receiveOverall.cPass, p.receiveOverall.miss, pct(p.receiveOverall.aPassRate)]]);
      if (p.receiveByType && p.receiveByType.length){
        section('レシーブ（相手攻撃種類別）', ['相手攻撃種類','総数','Aパス','Bパス','Cパス','ミス','Aパス率'],
          p.receiveByType.map(t=>[t.name, t.total, t.aPass, t.bPass, t.cPass, t.miss, pct(t.aPassRate)]));
      }
    }
    if (p.toss.total>0){
      section('トス', ['本数','成功','失敗','ミス','成功率'],
        [[p.toss.total, p.toss.success, p.toss.failure, p.toss.miss, pct(p.toss.successRate)]]);
    }
    if (p.block.decided>0){
      section('ブロック', ['決定本数','出場セット数','セットあたり'],
        [[p.block.decided, p.block.setsPlayed, num(p.block.perSet,2)]]);
    }
  });

  doc.save('vsTOP_' + teamName + '_選択集計.pdf');
  showToast('PDFを生成しました');
}

/// PDF出力の入り口。オンラインならjsPDFで直接生成し、
/// オフライン時・または生成に失敗した時はSafari等の印刷機能を使う方式に自動で切り替える。
async function exportSelectedAggregatePdf(teamName){
  const ids = state.selectedAggregateMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }

  if (typeof navigator!=='undefined' && navigator.onLine===false){
    state.pdfFallbackPrompt = { teamName, reason: 'オフラインです。' };
    render();
    return;
  }
  try{
    await generatePdfOnline(teamName);
  }catch(err){
    console.error('オンラインPDF生成に失敗:', err);
    state.pdfFallbackPrompt = { teamName, reason: 'オンラインでの生成に失敗しました（' + (err && err.message ? err.message : 'unknown error') + '）。' };
    render();
  }
}

/// 失敗した/オフラインだった時に表示する確認：印刷機能で生成するか、ユーザーに選んでもらう
function confirmPdfFallback(){
  const p = state.pdfFallbackPrompt;
  if (!p) return;
  state.pdfFallbackPrompt = null;
  printSelectedAggregateFallback(p.teamName);
}
function cancelPdfFallback(){ state.pdfFallbackPrompt = null; render(); }

/// オフライン時・オンライン生成失敗時のフォールバック：ブラウザの印刷機能（→「PDFとして保存」）を使う方式。
/// URLやヘッダー/フッターの非表示、横向き・余白の指定は端末の印刷設定に依存する。
function printSelectedAggregateFallback(teamName){
  const ids = state.selectedAggregateMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }
  const { matches, players } = statsForSelectedMatches(teamName, ids);
  const agg = aggregateFromPlayerList(players);

  const pages = [];

  const spikePlayers = players.filter(p=>p.spikeOverall.total>0)
    .sort((a,b)=>(b.spikeOverall.decisionRate??-1)-(a.spikeOverall.decisionRate??-1));
  const servePlayers = players.filter(p=>p.serve.total>0)
    .sort((a,b)=>(b.serve.effectiveRate??-1)-(a.serve.effectiveRate??-1));
  const catchPlayers = players.filter(p=>p.serveReceiveOverall.total>0)
    .sort((a,b)=>(b.serveReceiveOverall.aPassRate??-1)-(a.serveReceiveOverall.aPassRate??-1));

  pages.push(`
    <h1>${esc(teamName)}　選択試合の集計</h1>
    <p>対象試合数：${ids.length}件　出力日時：${new Date().toLocaleString('ja-JP')}</p>
    <h2>チーム全体成績</h2>
    <table>
      <tr><td>スパイク決定率</td><td>${pct(agg.spikeRate)}</td></tr>
      <tr><td>サーブ効果率</td><td>${pct(agg.serveRate)}</td></tr>
      <tr><td>キャッチAパス率</td><td>${pct(agg.catchRate)}</td></tr>
      <tr><td>ブロック</td><td>${agg.totalBlocks}</td></tr>
      <tr><td>サーブミス</td><td>${agg.serveMiss}</td></tr>
      <tr><td>スパイクミス</td><td>${agg.spikeMiss}</td></tr>
      <tr><td>被ブロック数</td><td>${agg.spikeBlocked}</td></tr>
      <tr><td>キャッチミス</td><td>${agg.catchMiss}</td></tr>
    </table>
  `);
  if (spikePlayers.length){
    pages.push(`
    <h2>スパイク（総合・決定率順）</h2>
    <table>
      <tr><th>#</th><th>選手名</th><th>総数</th><th>決定</th><th>ミス</th><th>被ブロック</th><th>決定率</th></tr>
      ${spikePlayers.map(p=>`<tr><td>${p.player.number}</td><td>${esc(p.player.name)}</td>
        <td>${p.spikeOverall.total}</td><td>${p.spikeOverall.decided}</td><td>${p.spikeOverall.miss}</td><td>${p.spikeOverall.blocked}</td><td>${pct(p.spikeOverall.decisionRate)}</td></tr>`).join('')}
    </table>`);
  }
  if (servePlayers.length){
    pages.push(`
    <h2>サーブ（総合・効果率順）</h2>
    <table>
      <tr><th>#</th><th>選手名</th><th>総数</th><th>決定</th><th>効果</th><th>ミス</th><th>効果率</th></tr>
      ${servePlayers.map(p=>`<tr><td>${p.player.number}</td><td>${esc(p.player.name)}</td>
        <td>${p.serve.total}</td><td>${p.serve.decided}</td><td>${p.serve.effective}</td><td>${p.serve.miss}</td><td>${pct(p.serve.effectiveRate)}</td></tr>`).join('')}
    </table>`);
  }
  if (catchPlayers.length){
    pages.push(`
    <h2>キャッチ（総合・Aパス率順）</h2>
    <table>
      <tr><th>#</th><th>選手名</th><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
      ${catchPlayers.map(p=>`<tr><td>${p.player.number}</td><td>${esc(p.player.name)}</td>
        <td>${p.serveReceiveOverall.total}</td><td>${p.serveReceiveOverall.aPass}</td><td>${p.serveReceiveOverall.bPass}</td><td>${p.serveReceiveOverall.cPass}</td><td>${p.serveReceiveOverall.miss}</td><td>${pct(p.serveReceiveOverall.aPassRate)}</td></tr>`).join('')}
    </table>`);
  }

  const validMatches = matches.filter(m=>sideForTeamInMatch(m, teamName));
  const nameForIdIn = (m, id) => {
    const ev = m.rallyLog.find(e=>e.playerId===id);
    return ev ? ev.playerName : '(不明)';
  };
  for (let i=0; i<validMatches.length; i+=5){
    const chunk = validMatches.slice(i, i+5);
    let matchesPage = i===0 ? `<h2>試合ごとの記録</h2>` : `<h2>試合ごとの記録（続き）</h2>`;
    chunk.forEach((m, idx)=>{
      const side = sideForTeamInMatch(m, teamName);
      const startingLineup = side==='home' ? m.homeStartingLineup : m.awayStartingLineup;
      const scoreText = m.setScores.map(s=>s.home+'-'+s.away).join(' / ');
      if (idx>0) matchesPage += `<hr style="border:none;border-top:1px solid #999;margin:10px 0;">`;
      matchesPage += `<h3>${esc(m.homeTeamName)} vs ${esc(m.awayTeamName)}　${new Date(m.date).toLocaleDateString('ja-JP')}</h3>`;
      matchesPage += `<p>スコア：${esc(scoreText)}</p>`;
      matchesPage += `<p><strong>スタメン：</strong>${(startingLineup||[]).map(e=>`${e.position}:${esc(nameForIdIn(m,e.playerId))}`).join('　') || '記録なし'}</p>`;
      matchesPage += (m.substitutedPlayerIds && m.substitutedPlayerIds.length)
        ? `<p><strong>メンバーチェンジで出場した選手：</strong>${m.substitutedPlayerIds.map(id=>esc(nameForIdIn(m,id))).join('　')}</p>`
        : `<p class="muted">メンバーチェンジなし</p>`;
    });
    pages.push(matchesPage);
  }

  const playersByNumber = players.slice().sort((a,b)=>a.player.number-b.player.number);
  playersByNumber.forEach(p=>{
    let ph = `<h2>${esc(p.player.name)}（#${p.player.number}）</h2>`;
    ph += p.participationType
      ? `<p>出場形態：${esc(p.participationType)}${p.participationType==='MC'?'（途中出場）':''}　出場セット数：${p.setsParticipated}</p>`
      : `<p>出場セット数：${p.setsParticipated}</p>`;

    if (p.spikeOverall.total>0){
      ph += `<h3>スパイク（総合）</h3><table>
        <tr><th>総数</th><th>決定</th><th>ミス</th><th>被ブロック</th><th>決定率</th></tr>
        <tr><td>${p.spikeOverall.total}</td><td>${p.spikeOverall.decided}</td><td>${p.spikeOverall.miss}</td><td>${p.spikeOverall.blocked}</td><td>${pct(p.spikeOverall.decisionRate)}</td></tr>
      </table>`;
      if (p.spikeByCombo && p.spikeByCombo.length){
        ph += `<h3>スパイク（コンビ別）</h3><table>
          <tr><th>コンビ</th><th>総数</th><th>決定</th><th>ミス</th><th>被ブロック</th><th>決定率</th></tr>
          ${p.spikeByCombo.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.total}</td><td>${c.decided}</td><td>${c.miss}</td><td>${c.blocked}</td><td>${pct(c.decisionRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.serve.total>0){
      ph += `<h3>サーブ（総合）</h3><table>
        <tr><th>総数</th><th>決定</th><th>効果</th><th>ミス</th><th>効果率</th></tr>
        <tr><td>${p.serve.total}</td><td>${p.serve.decided}</td><td>${p.serve.effective}</td><td>${p.serve.miss}</td><td>${pct(p.serve.effectiveRate)}</td></tr>
      </table>`;
      if (p.serveByType && p.serveByType.length){
        ph += `<h3>サーブ（種類別）</h3><table>
          <tr><th>種類</th><th>総数</th><th>決定</th><th>効果</th><th>ミス</th><th>効果率</th></tr>
          ${p.serveByType.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.total}</td><td>${t.decided}</td><td>${t.effective}</td><td>${t.miss}</td><td>${pct(t.effectiveRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.serveReceiveOverall.total>0){
      ph += `<h3>キャッチ（総合）</h3><table>
        <tr><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
        <tr><td>${p.serveReceiveOverall.total}</td><td>${p.serveReceiveOverall.aPass}</td><td>${p.serveReceiveOverall.bPass}</td><td>${p.serveReceiveOverall.cPass}</td><td>${p.serveReceiveOverall.miss}</td><td>${pct(p.serveReceiveOverall.aPassRate)}</td></tr>
      </table>`;
      if (p.serveReceiveByType && p.serveReceiveByType.length){
        ph += `<h3>キャッチ（相手サーブ種類別）</h3><table>
          <tr><th>相手サーブ種類</th><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
          ${p.serveReceiveByType.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.total}</td><td>${t.aPass}</td><td>${t.bPass}</td><td>${t.cPass}</td><td>${t.miss}</td><td>${pct(t.aPassRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.receiveOverall.total>0){
      ph += `<h3>レシーブ（総合）</h3><table>
        <tr><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
        <tr><td>${p.receiveOverall.total}</td><td>${p.receiveOverall.aPass}</td><td>${p.receiveOverall.bPass}</td><td>${p.receiveOverall.cPass}</td><td>${p.receiveOverall.miss}</td><td>${pct(p.receiveOverall.aPassRate)}</td></tr>
      </table>`;
      if (p.receiveByType && p.receiveByType.length){
        ph += `<h3>レシーブ（相手攻撃種類別）</h3><table>
          <tr><th>相手攻撃種類</th><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
          ${p.receiveByType.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.total}</td><td>${t.aPass}</td><td>${t.bPass}</td><td>${t.cPass}</td><td>${t.miss}</td><td>${pct(t.aPassRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.toss.total>0){
      ph += `<h3>トス</h3><table>
        <tr><th>本数</th><th>成功</th><th>失敗</th><th>ミス</th><th>成功率</th></tr>
        <tr><td>${p.toss.total}</td><td>${p.toss.success}</td><td>${p.toss.failure}</td><td>${p.toss.miss}</td><td>${pct(p.toss.successRate)}</td></tr>
      </table>`;
    }
    if (p.block.decided>0){
      ph += `<h3>ブロック</h3><table>
        <tr><th>決定本数</th><th>出場セット数</th><th>セットあたり</th></tr>
        <tr><td>${p.block.decided}</td><td>${p.block.setsPlayed}</td><td>${num(p.block.perSet,2)}</td></tr>
      </table>`;
    }
    pages.push(ph);
  });

  const html = pages.map((p,i)=>`<div style="${i===pages.length-1?'':'page-break-after:always;'}">${p}</div>`).join('');
  const printArea = document.getElementById('print-area');
  if (!printArea){ showToast('印刷用の領域が見つかりませんでした'); return; }
  printArea.innerHTML = html;
  showToast('印刷ダイアログで「用紙の向き：横」を選んでください（URLを消すには「ヘッダーとフッター」もオフに）');
  window.print();
}


function renderCsvTab(teamName){
  const matches = matchesInvolvingTeamName(teamName);
  if (!state.csvSelectedMatchIds) state.csvSelectedMatchIds = [];
  let html = `<p class="muted">「${esc(teamName)}」が関わった試合のみ表示しています。出力する試合を選んでください（複数選択可）。選手ごとに1つのCSVファイルが作成されます。</p>`;
  html += matches.map(m=>{
    const label = m.id==='current'
      ? '進行中：'+m.homeTeamName+' vs '+m.awayTeamName
      : new Date(m.date).toLocaleDateString('ja-JP')+' '+m.homeTeamName+' vs '+m.awayTeamName;
    const checked = state.csvSelectedMatchIds.includes(m.id);
    return `
    <label class="row gap8" style="padding:8px 0;border-bottom:1px solid var(--line);">
      <input type="checkbox" ${checked?'checked':''} onchange="toggleCsvMatchSelection('${m.id}')"> ${esc(label)}
    </label>`;
  }).join('') || '<p class="muted">まだ試合記録がありません</p>';
  html += `<button class="btn primary" style="width:100%;margin-top:14px;" onclick="runCsvExport('${teamName.replace(/'/g,"\\'")}')">📤 選手ごとのCSVを書き出す</button>`;
  html += `<p class="muted" style="margin-top:8px;">選手が複数いる場合は1つのZIPファイルにまとめて書き出します（保存の確実性を優先しています。ファイルを開くには展開/解凍してください）。iPad/iPhoneでは共有シートから「ファイルに保存」を選べます。</p>`;
  html += `<button class="btn" style="width:100%;margin-top:8px;" onclick="runCsvExportDownloadOnly('${teamName.replace(/'/g,"\\'")}')">常にダウンロードする（共有シートを使わない）</button>`;
  return html;
}
function toggleCsvMatchSelection(id){
  if (!state.csvSelectedMatchIds) state.csvSelectedMatchIds = [];
  const idx = state.csvSelectedMatchIds.indexOf(id);
  if (idx>=0) state.csvSelectedMatchIds.splice(idx,1);
  else state.csvSelectedMatchIds.push(id);
  render();
}
function runCsvExport(teamName){
  const ids = state.csvSelectedMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }
  exportDetailedCSVSmart(ids, teamName);
}
function runCsvExportDownloadOnly(teamName){
  const ids = state.csvSelectedMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }
  exportDetailedCSV(ids, teamName);
}

/* ==================== ランキング ==================== */

function rankingRow(name, primaryValue, primaryText, detail){ return {name, primaryValue, primaryText, detail}; }

function renderRankingList(rows, metricLabel){
  const sorted = rows.slice().sort((a,b)=>(b.primaryValue===null?-1:b.primaryValue)-(a.primaryValue===null?-1:a.primaryValue));
  if (sorted.length===0) return '<p class="muted">まだ記録がありません</p>';
  return sorted.map((r,i)=>`
    <div class="row" style="justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--line);">
      <div class="row gap10">
        <strong style="width:24px;color:${i===0?'#f59e0b':'#6b7280'}">${i+1}</strong>
        <div class="col">
          <span style="font-weight:600;">${esc(r.name)}</span>
          <span class="muted" style="font-size:11px;">${esc(r.detail)}</span>
        </div>
      </div>
      <div class="col" style="align-items:flex-end;">
        <strong>${esc(r.primaryText)}</strong>
        <span class="muted" style="font-size:11px;">${esc(metricLabel)}</span>
      </div>
    </div>`).join('');
}
function scopePickerHtml(field, options){
  return `
  <select class="field" style="max-width:220px;margin-bottom:10px;" onchange="state.${field}=this.value; render();">
    ${options.map(o=>`<option value="${esc(o)}" ${state[field]===o?'selected':''}>${esc(o)}</option>`).join('')}
  </select>`;
}

/// 通算ランキング（自チーム/相手チーム、これまでの全試合を対象）
function renderRankingsBody(teamName){
  const all = careerDetailedStatsForTeamName(teamName);
  return renderRankingsBodyForList(all, allUsedCombosForTeamName(teamName), allUsedOpponentServeTypesForTeamName(teamName), allUsedOpponentAttackTypesForTeamName(teamName));
}

/// 通算/単一試合どちらでも使える、ランキング本体のレンダリング。
/// スコープの選択肢自体を引数で渡すため、通算・試合どちらでも同じ状態キーを使い回せる。

function renderRankingsBodyForList(all, combosScope, serveTypesScope, attackTypesScope){
  const rt = state.rankingsTab || 'spike';
  const tabs = [['spike','スパイク'],['serve','サーブ'],['catch','キャッチ'],['receive','レシーブ'],['toss','トス'],['block','ブロック']];
  let html = `<div class="tabbar" style="margin-bottom:12px;">
    ${tabs.map(([k,label])=>`<button class="${rt===k?'active':''}" onclick="state.rankingsTab='${k}'; render();">${label}</button>`).join('')}
  </div>`;

  if (rt==='spike'){
    if (!state.spikeScope) state.spikeScope='総合';
    const scopes = ['総合', ...combosScope];
    html += scopePickerHtml('spikeScope', scopes);
    const rows = all.map(s=>{
      const target = state.spikeScope==='総合' ? s.spikeOverall : s.spikeByCombo.find(c=>c.name===state.spikeScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.decisionRate, pct(target.decisionRate), `総数${target.total}　決定${target.decided}　ミス${target.miss}`);
    }).filter(Boolean);
    html += renderRankingList(rows, '決定率');
  } else if (rt==='serve'){
    const rows = all.filter(s=>s.serve.total>0).map(s=>
      rankingRow(s.player.name, s.serve.effectiveRate, pct(s.serve.effectiveRate), `総数${s.serve.total}　決定${s.serve.decided}　効果${s.serve.effective}　ミス${s.serve.miss}`));
    html += renderRankingList(rows, '効果率');
  } else if (rt==='catch'){
    if (!state.catchScope) state.catchScope='総合';
    const scopes = ['総合', ...serveTypesScope];
    html += scopePickerHtml('catchScope', scopes);
    const rows = all.map(s=>{
      const target = state.catchScope==='総合' ? s.serveReceiveOverall : s.serveReceiveByType.find(c=>c.name===state.catchScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.aPassRate, pct(target.aPassRate), `総数${target.total}　A${target.aPass}　B${target.bPass}　C${target.cPass}`);
    }).filter(Boolean);
    html += renderRankingList(rows, 'Aパス率');
  } else if (rt==='receive'){
    if (!state.receiveScope) state.receiveScope='総合';
    const scopes = ['総合', ...attackTypesScope];
    html += scopePickerHtml('receiveScope', scopes);
    const rows = all.map(s=>{
      const target = state.receiveScope==='総合' ? s.receiveOverall : s.receiveByType.find(c=>c.name===state.receiveScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.aPassRate, pct(target.aPassRate), `総数${target.total}　A${target.aPass}　B${target.bPass}　C${target.cPass}`);
    }).filter(Boolean);
    html += renderRankingList(rows, 'Aパス率');
  } else if (rt==='toss'){
    const rows = all.filter(s=>s.toss.total>0).map(s=>
      rankingRow(s.player.name, s.toss.successRate, pct(s.toss.successRate), `本数${s.toss.total}　成功${s.toss.success}　失敗${s.toss.failure}　ミス${s.toss.miss}`));
    html += renderRankingList(rows, '成功率');
  } else if (rt==='block'){
    const rows = all.filter(s=>s.block.decided>0).map(s=>
      rankingRow(s.player.name, s.block.perSet, num(s.block.perSet,2), `決定本数${s.block.decided}　出場セット${s.block.setsPlayed}`));
    html += renderRankingList(rows, 'セットあたり');
  }
  return html;
}