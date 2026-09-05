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
      <div class="home-buttons">
        ${paused ? `
          <button class="home-btn" onclick="state.screen='match'; render();">
            <span class="ic">▶️</span>
            <span class="col"><span class="tt">試合を再開する</span><span class="st">一時停止中の記録を続ける</span></span>
            <span class="chev">›</span>
          </button>
          <button class="home-btn indigo" onclick="resetForNewGame(); state.screen='match'; render();">
            <span class="ic">➕</span>
            <span class="col"><span class="tt">新しい試合を開始する</span><span class="st">今の記録は保存してリセットします</span></span>
            <span class="chev">›</span>
          </button>
        ` : `
          <button class="home-btn" onclick="state.showingStartingLineup=true; state.screen='match'; render();">
            <span class="ic">▶️</span>
            <span class="col"><span class="tt">ゲーム開始</span><span class="st">試合の記録を始める</span></span>
            <span class="chev">›</span>
          </button>
        `}
        <button class="home-btn green" onclick="openSheet('records')">
          <span class="ic">📊</span>
          <span class="col"><span class="tt">スタッツ記録を見る</span><span class="st">試合ごと・選手ごとの通算成績</span></span>
          <span class="chev">›</span>
        </button>
        <button class="home-btn orange" onclick="openSheet('gamePrep')">
          <span class="ic">👥</span>
          <span class="col"><span class="tt">ゲーム準備</span><span class="st">チーム名・選手を登録する</span></span>
          <span class="chev">›</span>
        </button>
      </div>
    </div>
  </div>`;
}
