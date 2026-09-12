/* team-management.js — チーム・選手管理：チーム名の登録、名簿の読み込み/保存、選手の追加・削除、メンバーチェンジ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

/// 選手のポジション配列を返す（一人につき最大2つ）。
/// 古いデータ（position:文字列 一つだけ）が残っていても壊れないようにする
function playerPositions(p){
  if (!p) return [];
  if (Array.isArray(p.positions)) return p.positions.filter(Boolean);
  if (p.position && p.position!=='-') return [p.position];
  return [];
}

/// ポジションに応じた表示色。複数ポジションの場合は斜め2分割でシンプルに表示する
function positionColorStyle(p){
  const positions = playerPositions(p);
  const colors = positions.map(pos=>POSITION_COLORS[pos]).filter(Boolean);
  if (colors.length===0) return '';
  if (colors.length===1) return `background:${colors[0]};`;
  return `background:linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%);`;
}

/// 選手のポジション表示用テキスト。未設定の場合は空欄ではなく「未設定」と表示する
function positionsDisplayText(p){
  const positions = playerPositions(p);
  return positions.length ? positions.join('/') : '未設定';
}

function registerTeamName(name){
  const trimmed = (name||'').trim();
  if (!trimmed) return;
  state.knownTeamNames = state.knownTeamNames.filter(n=>n!==trimmed);
  state.knownTeamNames.unshift(trimmed);
  if (!state.teamRosters[trimmed]) state.teamRosters[trimmed] = createDefaultRoster();
}

function registerTournamentName(name){
  const trimmed = (name||'').trim();
  if (!trimmed) return;
  state.knownTournamentNames = state.knownTournamentNames.filter(n=>n!==trimmed);
  state.knownTournamentNames.unshift(trimmed);
}

function orderedTeamNames(){
  if (state.myTeamName && state.knownTeamNames.includes(state.myTeamName)){
    return [state.myTeamName, ...state.knownTeamNames.filter(n=>n!==state.myTeamName)];
  }
  return state.knownTeamNames;
}

function loadRosterFromProfile(team){
  const name = team==='home' ? state.homeTeamName : state.awayTeamName;
  const saved = state.teamRosters[name];
  if (saved){ if (team==='home') state.homePlayers = saved; else state.awayPlayers = saved; }
}

function syncRosterToProfile(team){
  const name = team==='home' ? state.homeTeamName : state.awayTeamName;
  state.teamRosters[name] = team==='home' ? state.homePlayers : state.awayPlayers;
}

/// ゲーム準備画面で名簿を編集した時、それが「今使っている自チーム/相手チーム」の名前と一致するなら、
/// 記録画面側の選手一覧（state.homePlayers/awayPlayers）にもすぐ反映されるようにする
function syncLiveRosterIfActive(teamName){
  if (state.homeTeamName === teamName) state.homePlayers = state.teamRosters[teamName] || [];
  if (state.awayTeamName === teamName) state.awayPlayers = state.teamRosters[teamName] || [];
}

function addPlayer(team){
  const list = currentPlayers(team);
  const used = new Set(list.map(p=>p.number));
  let n=1; while(used.has(n)) n++;
  list.push({id:uid(), number:n, name:'新しい選手', positions:['OH']});
  syncRosterToProfile(team);
  render();
}

function removePlayer(team, id){
  if (team==='home') state.homePlayers = state.homePlayers.filter(p=>p.id!==id);
  else state.awayPlayers = state.awayPlayers.filter(p=>p.id!==id);
  syncRosterToProfile(team);
  render();
}

function updatePlayerField(team, id, field, value){
  const list = currentPlayers(team);
  const p = list.find(p=>p.id===id);
  if (!p) return;
  if (field==='number') p.number = parseInt(value,10) || 0;
  else p[field] = value;
  syncRosterToProfile(team);
}

function benchPlayers(team){
  const list = currentPlayers(team);
  const onCourt = new Set(currentRotation(team).filter(Boolean));
  const liberoIds = new Set((liberoSelection(team)||[]).filter(Boolean));
  return list.filter(p=>!onCourt.has(p.id) && !liberoIds.has(p.id));
}

/// メンバーチェンジ：出た選手・入った選手の両方を「この試合で交代したことがある」として記録しておく
function substitute(team, positionIndex, incomingId){
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const outgoingId = rotation[positionIndex];
  if (!state.substitutedPlayerIds) state.substitutedPlayerIds = [];
  [outgoingId, incomingId].forEach(id=>{
    if (id && !state.substitutedPlayerIds.includes(id)) state.substitutedPlayerIds.push(id);
  });
  rotation[positionIndex] = incomingId;
  refreshServerSelectionIfNeeded();
  render();
}

/// リベロ(L1/L2)は名簿の「ポジション」欄ではなく、試合開始設定でその試合ごとに選んだ2名を使う
function liberos(team){
  const sel = team==='home' ? state.homeLiberoSelection : state.awayLiberoSelection;
  return (sel||[]).map(id => id ? findPlayer(id, team) : null).filter(Boolean);
}
function liberoSelection(team){ return team==='home' ? state.homeLiberoSelection : state.awayLiberoSelection; }

/* ---- チーム名ごとに、最後に使ったスタメン（ローテーション・リベロ）を記憶する ---- */

/// 試合開始時に、そのチーム名の現在のスタメンを「最後に使ったスタメン」として保存する
function saveLastLineupForTeamName(team, teamName){
  if (!state.lastLineupByTeamName) state.lastLineupByTeamName = {};
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const liberoSel = team==='home' ? state.homeLiberoSelection : state.awayLiberoSelection;
  state.lastLineupByTeamName[teamName] = { rotation: rotation.slice(), liberoSelection: (liberoSel||[null,null]).slice() };
}

/// チーム名を選んだとき、そのチーム名で前回使ったスタメン・リベロが記録されていれば自動で復元する
/// （名簿の選手が変わっていて選手IDが一致しない場合は復元しない）
function applyLastLineupIfAvailable(team, teamName){
  if (!state.lastLineupByTeamName) return;
  const saved = state.lastLineupByTeamName[teamName];
  if (!saved) return;
  const players = currentPlayers(team);
  const rotationOk = saved.rotation.length===6 && saved.rotation.every(id => id && players.some(p=>p.id===id));
  if (rotationOk){
    if (team==='home') state.homeRotation = saved.rotation.slice();
    else state.awayRotation = saved.rotation.slice();
  }
  const liberoOk = (saved.liberoSelection||[]).every(id => !id || players.some(p=>p.id===id));
  if (liberoOk){
    if (team==='home') state.homeLiberoSelection = (saved.liberoSelection||[null,null]).slice();
    else state.awayLiberoSelection = (saved.liberoSelection||[null,null]).slice();
  }
}

/* ========================= スタッツ集計 ========================= */