/* render-common.js — 共通のレンダリング補助：エスケープ処理、画面の振り分け、シートの開閉、チーム名選択の処理
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function pct(v, digits){ return v===null||v===undefined ? '-' : v.toFixed(digits===undefined?1:digits)+'%'; }

function num(v, digits){ return v===null||v===undefined ? '-' : v.toFixed(digits===undefined?2:digits); }

function renderScreen(){
  let html = '';
  if (state.screen==='home') html = renderHome();
  else if (state.screen==='match') html = renderMatch();
  html += renderActiveSheet();
  return html;
}

function handleTeamNameSelect(team, value){
  if (value==='__new__'){
    const name = window.prompt('チーム名を入力してください');
    if (name && name.trim()){
      registerTeamName(name.trim());
      if (team==='home') state.homeTeamName=name.trim(); else state.awayTeamName=name.trim();
      loadRosterFromProfile(team);
    }
  } else {
    if (team==='home') state.homeTeamName=value; else state.awayTeamName=value;
    loadRosterFromProfile(team);
  }
  render();
}

function handleTournamentSelect(value){
  if (value==='__new__'){
    const name = window.prompt('大会名を入力してください');
    if (name && name.trim()){ registerTournamentName(name.trim()); state.tournamentName=name.trim(); }
  } else { state.tournamentName = value; }
  render();
}

/* ========================= ホーム画面 ========================= */

function openSheet(name){ state.activeSheet = name; render(); }

function closeSheet(){ state.activeSheet = null; render(); }

/* ========================= 試合開始設定（スタメン） ========================= */
