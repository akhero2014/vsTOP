/* render-home.js — ホーム画面の描画
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function renderHome(){
  const paused = hasPausedGame();
  return `
  <div class="screen home">
    <div class="home-card">
      <div class="home-logo">🏐</div>
      <div class="home-title">vsTOP</div>
      <p class="muted" style="margin-top:2px;">バレーボール スタッツ</p>
      ${state.myTeamName ? `<p class="muted">自チーム：${esc(state.myTeamName)}</p>` : ''}
      <div class="home-buttons-grid">
        <div class="home-col">
          ${paused ? `
            <button class="home-btn home-btn-tall" onclick="state.screen='match'; render();">
              <span class="ic">▶️</span>
              <span class="col"><span class="tt">試合を再開する</span><span class="st">一時停止中の記録を続ける</span></span>
            </button>
            <button class="home-btn home-btn-tall indigo" onclick="resetForNewGame(); state.screen='match'; render();">
              <span class="ic">➕</span>
              <span class="col"><span class="tt">新しい試合を開始する</span><span class="st">今の記録は保存してリセットします</span></span>
            </button>
          ` : `
            <button class="home-btn home-btn-tall" onclick="state.showingStartingLineup=true; state.screen='match'; render();">
              <span class="ic">▶️</span>
              <span class="col"><span class="tt">ゲーム開始</span><span class="st">試合の記録を始める</span></span>
            </button>
          `}
          <button class="home-btn home-btn-tall green" onclick="openSheet('records')">
            <span class="ic">📊</span>
            <span class="col"><span class="tt">スタッツ記録を見る</span><span class="st">試合ごと・選手ごとの通算成績</span></span>
          </button>
        </div>
        <div class="home-col">
          <button class="home-btn orange" onclick="openSheet('gamePrep')">
            <span class="ic">👥</span>
            <span class="col"><span class="tt">ゲーム準備</span><span class="st">チーム名・選手を登録する</span></span>
            <span class="chev">›</span>
          </button>
          <button class="home-btn" onclick="openSheet('settings')">
            <span class="ic">⚙️</span>
            <span class="col"><span class="tt">設定</span><span class="st">入力設定・カスタム項目の編集</span></span>
            <span class="chev">›</span>
          </button>
          ${backupHomeButtonHtml()}
          <button class="home-btn" onclick="openSheet('pdfCleanup')">
            <span class="ic">🧹</span>
            <span class="col"><span class="tt">PDFのヘッダー/フッターを除去</span><span class="st">印刷で作ったPDFからURL等を削除</span></span>
            <span class="chev">›</span>
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

/// バックアップ状況を表示するホーム画面のボタン。前回バックアップ以降に新しい記録があれば強調表示する。
/* ==================== PDFのヘッダー/フッター除去（印刷で作ったPDFの後処理） ====================
   PDF生成そのもの（jsPDF等）は諦め、代わりに「Safari等の印刷機能で作ったPDF」を取り込んで、
   ブラウザが自動で付け足すヘッダー/フッター（URL・日付・ページ番号など）を上下から
   切り取る（CropBoxを狭める）ことで見えなくする。PDF操作にはpdf-lib（CDN）を使う。
   ページの内容自体は変更せず、表示・印刷範囲だけを狭めるので安全に元へ戻せる。 */

const PDF_LIB_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
];

const PDF_LIB_CACHE_NAME = 'vstop-pdflib-cache-v1';

/// ライブラリ本体をテキストとして取得し、Cache APIに保存しておく。
/// 一度オンラインで取得できれば、次回以降はキャッシュから読み込むためオフラインでも使える。
async function fetchLibraryTextWithCache(urls, cacheName){
  if ('caches' in window){
    try{
      const cache = await caches.open(cacheName);
      for (const url of urls){
        const cached = await cache.match(url);
        if (cached) return await cached.text();
      }
    }catch(e){ /* キャッシュが使えなくても下のfetchにフォールバックする */ }
  }
  let lastError = null;
  for (const url of urls){
    try{
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTPステータス ' + res.status);
      if ('caches' in window){
        try{ const cache = await caches.open(cacheName); await cache.put(url, res.clone()); }catch(e){}
      }
      return await res.text();
    }catch(err){ lastError = err; }
  }
  throw lastError || new Error('ライブラリの取得に失敗しました（オフラインで、かつ未取得の可能性があります）');
}

async function ensurePdfLibLoaded(){
  if (window.PDFLib && window.PDFLib.PDFDocument) return;
  const code = await fetchLibraryTextWithCache(PDF_LIB_URLS, PDF_LIB_CACHE_NAME);
  const s = document.createElement('script');
  s.textContent = code;
  document.head.appendChild(s);
  if (!(window.PDFLib && window.PDFLib.PDFDocument)) throw new Error('pdf-libの読み込みに失敗しました');
}

function renderPdfCleanupSheet(){
  const top = state.pdfCleanupTopMm!==undefined ? state.pdfCleanupTopMm : 15;
  const bottom = state.pdfCleanupBottomMm!==undefined ? state.pdfCleanupBottomMm : 15;
  const body = `
    <p class="muted">Safari等の「印刷」→「PDFとして保存」で作ったPDFファイルを選んでください。上下から指定した幅を切り取り、ブラウザが自動で付け足すヘッダー/フッター（URL・日付・ページ番号など）を除去したPDFを新しく作成します。</p>
    <label class="muted">上から削る幅（mm）</label>
    <input class="field" type="number" min="0" step="1" value="${top}" oninput="state.pdfCleanupTopMm=parseFloat(this.value)||0;" style="margin-bottom:10px;">
    <label class="muted">下から削る幅（mm）</label>
    <input class="field" type="number" min="0" step="1" value="${bottom}" oninput="state.pdfCleanupBottomMm=parseFloat(this.value)||0;" style="margin-bottom:14px;">
    <input type="file" id="pdfCleanupFileInput" accept="application/pdf,.pdf" style="margin-bottom:14px;display:block;">
    <button class="btn primary" style="width:100%;" onclick="runPdfCleanup()">PDFを処理してダウンロード</button>
    <p class="muted" style="font-size:11px;margin-top:10px;">※ 初回の処理にはインターネット接続が必要です（pdf-libというライブラリをCDNから取得します）。一度取得できれば端末に保存され、2回目以降はオフラインでも使えます。切り取りすぎると本文まで消えるので、まず少なめの値から試すのがおすすめです。</p>
  `;
  return sheetShell('PDFのヘッダー/フッターを除去', body);
}

async function runPdfCleanup(){
  const input = document.getElementById('pdfCleanupFileInput');
  const file = input && input.files && input.files[0];
  if (!file){ showToast('PDFファイルを選んでください'); return; }
  const topMm = state.pdfCleanupTopMm!==undefined ? state.pdfCleanupTopMm : 15;
  const bottomMm = state.pdfCleanupBottomMm!==undefined ? state.pdfCleanupBottomMm : 15;
  const mmToPt = (mm) => mm * 72 / 25.4;

  showToast('処理しています…');
  try{
    await ensurePdfLibLoaded();
    const bytes = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(bytes);
    const topPt = mmToPt(topMm);
    const bottomPt = mmToPt(bottomMm);
    pdfDoc.getPages().forEach(page=>{
      const { width, height } = page.getSize();
      const newHeight = Math.max(10, height - topPt - bottomPt);
      // CropBoxを狭めることで、上下のヘッダー/フッター部分を表示・印刷対象から外す
      page.setCropBox(0, bottomPt, width, newHeight);
    });
    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (file.name||'document').replace(/\.pdf$/i,'') + '_除去済み.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    showToast('処理が完了しました');
  }catch(err){
    console.error('PDF処理エラー:', err);
    showToast('処理に失敗しました：' + (err && err.message ? err.message : 'unknown error'));
  }
}

function backupHomeButtonHtml(){
  const current = totalEventFingerprint();
  const hasUnsavedData = state.lastBackupFingerprint===undefined || current > state.lastBackupFingerprint;
  const lastText = state.lastBackupAt ? new Date(state.lastBackupAt).toLocaleString('ja-JP') : 'まだバックアップしていません';
  return `
  <button class="home-btn ${hasUnsavedData?'orange':''}" onclick="openSheet('backup')">
    <span class="ic">💾</span>
    <span class="col">
      <span class="tt">データのバックアップ${hasUnsavedData?' ⚠️':''}</span>
      <span class="st">最終バックアップ：${esc(lastText)}${hasUnsavedData && state.lastBackupAt ? '（未バックアップの記録があります）':''}</span>
    </span>
    <span class="chev">›</span>
  </button>`;
}