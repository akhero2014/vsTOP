/* render-common.js — 共通のレンダリング補助：エスケープ処理、画面の振り分け、トースト通知、
   実行確認ボタン、チーム名・大会名の選択/新規追加（promptは使わない）
   vsTOP アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function pct(v, digits){ return v===null||v===undefined ? '-' : v.toFixed(digits===undefined?1:digits)+'%'; }

function num(v, digits){ return v===null||v===undefined ? '-' : v.toFixed(digits===undefined?2:digits); }

function renderScreen(){
  let html = '';
  if (state.screen==='home') html = renderHome();
  else if (state.screen==='match') html = renderMatch();
  html += renderActiveSheet();
  if (state.toastMessage) html += `<div class="toast">${esc(state.toastMessage)}</div>`;
  return html;
}

/// alert()の代わりに使う、画面内蔵の簡易トースト通知（ダイアログがブロックされる環境でも確実に表示される）
function showToast(msg){
  state.toastMessage = msg;
  render();
  const captured = msg;
  setTimeout(()=>{ if (state.toastMessage===captured){ state.toastMessage=null; render(); } }, 3200);
}

/// prompt()に依存しない、汎用の「実行確認」ボタン。1回目のタップで「はい/いいえ」を表示し、
/// 「はい」を押すと onConfirmCall（文字列で渡したJSコード）を実行する。
function confirmButtonHtml(id, label, onConfirmCall, cls){
  if (state.confirmingId===id){
    return `<span class="row gap8">
      <span class="muted" style="font-size:12px;">本当に実行しますか？</span>
      <button class="btn danger small" onclick="state.confirmingId=null; ${onConfirmCall}">はい</button>
      <button class="btn small" onclick="state.confirmingId=null; render();">いいえ</button>
    </span>`;
  }
  return `<button class="btn ${cls||'danger'}" onclick="state.confirmingId='${id}'; render();">${esc(label)}</button>`;
}

function handleTeamNameSelect(team, value){
  if (team==='home') state.homeTeamName=value; else state.awayTeamName=value;
  loadRosterFromProfile(team);
  render();
}
function handleTournamentSelect(value){
  state.tournamentName = value;
  render();
}

/* ---- 新規チーム名の追加（プルダウンの横の「＋」から。promptは使わない） ---- */
function startAddTeamName(team){ state.addingTeamFor = team; state.newNameDraft=''; render(); }
function cancelAddTeamName(){ state.addingTeamFor = null; render(); }
function confirmAddTeamName(){
  const name = (state.newNameDraft||'').trim();
  if (!name){ showToast('チーム名を入力してください'); return; }
  const team = state.addingTeamFor;
  registerTeamName(name);
  if (team==='home') state.homeTeamName=name; else state.awayTeamName=name;
  loadRosterFromProfile(team);
  state.addingTeamFor = null;
  render();
}

/* ---- 新規大会名の追加 ---- */
function startAddTournament(){ state.addingTournament = true; state.newNameDraft=''; render(); }
function cancelAddTournament(){ state.addingTournament = false; render(); }
function confirmAddTournament(){
  const name = (state.newNameDraft||'').trim();
  if (!name){ showToast('大会名を入力してください'); return; }
  registerTournamentName(name);
  state.tournamentName = name;
  state.addingTournament = false;
  render();
}

/* ---- 大会名の修正（追加直後にその場で直せるように） ---- */
function startRenameTournament(){ state.editingTournament = true; state.tournamentNameDraft = state.tournamentName; render(); }
function cancelRenameTournament(){ state.editingTournament = false; render(); }
function confirmRenameTournament(){
  const oldName = state.tournamentName;
  const newName = (state.tournamentNameDraft||'').trim();
  if (!newName){ showToast('大会名を入力してください'); return; }
  if (newName!==oldName){
    state.knownTournamentNames = state.knownTournamentNames.map(n=>n===oldName?newName:n);
    state.tournamentName = newName;
  }
  state.editingTournament = false;
  render();
}

/* ---- シートの開閉 ---- */
function openSheet(name){ state.activeSheet = name; render(); }
function closeSheet(){ state.activeSheet = null; render(); }
