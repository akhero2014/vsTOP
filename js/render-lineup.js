/* render-lineup.js — 試合開始設定（スタメン・リベロ・サーブ権・大会名など）画面の描画
   vsTOP アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function homeLineupValid(){
  return state.homeRotation.every(Boolean) && new Set(state.homeRotation).size===6;
}
function awayLineupValid(){
  return state.awayRotation.every(Boolean) && new Set(state.awayRotation).size===6;
}
/// ボタンの有効/無効判定。相手チームを記録しない設定のときは、相手側は自動で
/// 仮設定されるため、相手側の入力状況によらずボタンを有効にする。
function canAttemptStart(){
  if (!homeLineupValid()) return false;
  if (state.trackOpponentStats && !awayLineupValid()) return false;
  return true;
}
/// 両チームとも実際に6人埋まっているかどうかの厳密なチェック（自動仮設定の後に使う）
function lineupValid(){
  return homeLineupValid() && awayLineupValid();
}

/// 相手チームのスタッツを記録しない設定のとき、相手チームのスタメン6人とリベロ1人を
/// 「プレイヤー1」〜「プレイヤー7」という仮の選手として設定する（内部のローテーション/
/// サーブ権処理のために必要。実際の相手選手名は使わない）
function autoFillAwayLineupIfNeeded(){
  const placeholders = [];
  for (let i=1;i<=7;i++){
    placeholders.push({ id:uid(), number:i, name:'プレイヤー'+i, position: i===7 ? 'L' : 'OH' });
  }
  state.awayPlayers = placeholders;
  state.awayRotation = placeholders.slice(0,6).map(p=>p.id);
  state.awayLiberoSelection = [placeholders[6].id, null];
}

function startMatch(){
  if (!homeLineupValid()){
    showToast('自チームの6ポジションすべてに選手を設定してください');
    return;
  }
  if (state.trackOpponentStats && !awayLineupValid()){
    showToast('相手チームの6ポジションすべてに選手を設定してください');
    return;
  }
  if (!state.trackOpponentStats){
    autoFillAwayLineupIfNeeded();
  }

  // リベロの注意ポップは自チームのみ対象（相手を記録しない場合は仮のリベロ1人で運用するため対象外）
  const homeLiberoCount = (state.homeLiberoSelection||[]).filter(Boolean).length;
  if (homeLiberoCount < 2){
    state.showLiberoWarning = true;
    render();
    return;
  }
  actuallyStartMatch();
}
function actuallyStartMatch(){
  // スタメン未設定の警告は、リベロの警告より必ず優先する（保険の再チェック）。
  // 「このまま開始する」を押した時点でも、万一自チームが未設定ならここでブロックする。
  if (!homeLineupValid()){
    state.showLiberoWarning = false;
    showToast('自チームの6ポジションすべてに選手を設定してください');
    render();
    return;
  }
  saveLastLineupForTeamName('home', state.homeTeamName);
  if (state.trackOpponentStats) saveLastLineupForTeamName('away', state.awayTeamName);
  state.showLiberoWarning = false;
  state.showingStartingLineup = false;
  render();
}
function proceedWithoutFullLibero(){ actuallyStartMatch(); }
function cancelLiberoWarning(){ state.showLiberoWarning = false; render(); }

/* ---- ローテーションを1つ進める／戻す（スタメン設定中の並び替え用） ---- */

function lineupRotateForward(team){
  const rotation = (team==='home' ? state.homeRotation : state.awayRotation).slice();
  rotation.push(rotation.shift());
  if (team==='home') state.homeRotation = rotation; else state.awayRotation = rotation;
  render();
}
function lineupRotateBackward(team){
  const rotation = (team==='home' ? state.homeRotation : state.awayRotation).slice();
  rotation.unshift(rotation.pop());
  if (team==='home') state.homeRotation = rotation; else state.awayRotation = rotation;
  render();
}

/* ---- 6ポジションの選手選択 ---- */

function openLineupPicker(team, index){ state.lineupPicker = {team, index}; render(); }
function pickLineupPlayer(playerId){
  const {team, index} = state.lineupPicker;
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const already = rotation.indexOf(playerId);
  if (already>=0) rotation[already] = null;
  rotation[index] = playerId;
  state.lineupPicker = null;
  render();
}
function renderLineupSlot(team, index){
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const players = currentPlayers(team);
  const player = players.find(p=>p.id===rotation[index]);
  return `
    <button class="mini-slot ${player?'filled':''}" onclick="openLineupPicker('${team}', ${index})">
      <div class="c">${player ? player.number : '+'}</div>
      <div style="font-size:9px;opacity:.85">P${index+1}</div>
      <div style="font-size:10px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${player?esc(player.name):'未設定'}</div>
    </button>`;
}

/* ---- リベロ（L1/L2）の選手選択：6ポジションと同じくタップして選ぶ ---- */

function openLineupLiberoPicker(team, index){ state.lineupLiberoPicker = {team, index}; render(); }
function pickLineupLiberoPlayer(playerId){
  const {team, index} = state.lineupLiberoPicker;
  const sel = team==='home' ? state.homeLiberoSelection : state.awayLiberoSelection;
  const already = sel.indexOf(playerId);
  if (already>=0) sel[already] = null;
  sel[index] = playerId;
  state.lineupLiberoPicker = null;
  render();
}
function renderLineupLiberoSlot(team, index){
  const players = currentPlayers(team);
  const sel = team==='home' ? state.homeLiberoSelection : state.awayLiberoSelection;
  const player = players.find(p=>p.id===sel[index]);
  return `
    <button class="mini-slot ${player?'filled':''}" style="background:${player?'rgba(245,158,11,.5)':'rgba(0,0,0,.12)'};"
      onclick="openLineupLiberoPicker('${team}', ${index})">
      <div class="c" style="${player?'background:#f59e0b;':''}">${player ? player.number : '+'}</div>
      <div style="font-size:9px;opacity:.85">L${index+1}</div>
      <div style="font-size:10px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${player?esc(player.name):'未設定'}</div>
    </button>`;
}

function renderLineupCourt(team, title){
  const front = team==='home' ? HOME_FRONT : AWAY_FRONT;
  const back = team==='home' ? HOME_BACK : AWAY_BACK;
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const filled = rotation.filter(Boolean).length;
  const liberoFilled = (team==='home' ? state.homeLiberoSelection : state.awayLiberoSelection).filter(Boolean).length;
  return `
  <div>
    <div class="row" style="justify-content:space-between;margin-bottom:6px;">
      <strong>${esc(title)}</strong>
      <span class="muted">${filled}/6 人設定済み・L ${liberoFilled}/2</span>
    </div>
    <div class="mini-court">
      <div class="row gap8" style="margin-bottom:8px;">${front.map(i=>renderLineupSlot(team,i)).join('')}</div>
      <div class="row gap8">${back.map(i=>renderLineupSlot(team,i)).join('')}</div>
    </div>
    <div class="row gap8" style="margin-top:8px;">
      <span class="muted" style="align-self:center;">L：</span>
      ${renderLineupLiberoSlot(team,0)}
      ${renderLineupLiberoSlot(team,1)}
    </div>
    <div class="row gap8" style="margin-top:8px;">
      <button class="btn small" style="flex:1;" onclick="lineupRotateBackward('${team}')">◀ ローテーションを戻す</button>
      <button class="btn small" style="flex:1;" onclick="lineupRotateForward('${team}')">ローテーションを進める ▶</button>
    </div>
  </div>`;
}

/* ---- チーム名／大会名のプルダウン＋新規追加＋その場で修正 ---- */

function teamPickerHtml(team){
  const label = team==='home' ? '自チーム' : '相手チーム';
  const currentName = team==='home' ? state.homeTeamName : state.awayTeamName;
  const names = orderedTeamNames();

  if (state.addingTeamFor===team){
    return `
    <div class="col grow" style="min-width:200px;">
      <label class="muted">${label}</label>
      <div class="inline-add">
        <input class="field grow" placeholder="チーム名を入力" value="${esc(state.newNameDraft||'')}"
          oninput="state.newNameDraft=this.value" onkeydown="if(event.key==='Enter'){confirmAddTeamName();}">
        <button class="btn primary" onclick="confirmAddTeamName()">決定</button>
        <button class="btn" onclick="cancelAddTeamName()">キャンセル</button>
      </div>
    </div>`;
  }
  if (state.editingTeamName===currentName){
    return `
    <div class="col grow" style="min-width:200px;">
      <label class="muted">${label}（修正）</label>
      <div class="inline-add">
        <input class="field grow" value="${esc(state.teamNameDraft||'')}" oninput="state.teamNameDraft=this.value"
          onkeydown="if(event.key==='Enter'){confirmRenameTeam();}">
        <button class="btn primary" onclick="confirmRenameTeam()">保存</button>
        <button class="btn" onclick="cancelRenameTeam()">キャンセル</button>
      </div>
    </div>`;
  }
  return `
  <div class="col grow" style="min-width:200px;">
    <label class="muted">${label}</label>
    <div class="inline-add">
      <select class="field grow" onchange="handleTeamNameSelect('${team}', this.value)">
        ${names.map(n=>`<option value="${esc(n)}" ${n===currentName?'selected':''}>${esc(n)}</option>`).join('')}
      </select>
      <button class="btn" onclick="startAddTeamName('${team}')" title="新規チームを追加">＋</button>
      <button class="btn" onclick="startRenameTeam('${currentName.replace(/'/g,"\\'")}')" title="この名前を修正">✏️</button>
    </div>
  </div>`;
}
function tournamentPickerHtml(){
  if (state.addingTournament){
    return `
    <div class="col grow" style="min-width:200px;">
      <label class="muted">大会名（任意）</label>
      <div class="inline-add">
        <input class="field grow" placeholder="大会名を入力" value="${esc(state.newNameDraft||'')}"
          oninput="state.newNameDraft=this.value" onkeydown="if(event.key==='Enter'){confirmAddTournament();}">
        <button class="btn primary" onclick="confirmAddTournament()">決定</button>
        <button class="btn" onclick="cancelAddTournament()">キャンセル</button>
      </div>
    </div>`;
  }
  if (state.editingTournament){
    return `
    <div class="col grow" style="min-width:200px;">
      <label class="muted">大会名（修正）</label>
      <div class="inline-add">
        <input class="field grow" value="${esc(state.tournamentNameDraft||'')}" oninput="state.tournamentNameDraft=this.value"
          onkeydown="if(event.key==='Enter'){confirmRenameTournament();}">
        <button class="btn primary" onclick="confirmRenameTournament()">保存</button>
        <button class="btn" onclick="cancelRenameTournament()">キャンセル</button>
      </div>
    </div>`;
  }
  return `
  <div class="col grow" style="min-width:200px;">
    <label class="muted">大会名（任意）</label>
    <div class="inline-add">
      <select class="field grow" onchange="handleTournamentSelect(this.value)">
        <option value="" ${!state.tournamentName?'selected':''}>未選択</option>
        ${state.knownTournamentNames.map(n=>`<option value="${esc(n)}" ${n===state.tournamentName?'selected':''}>${esc(n)}</option>`).join('')}
      </select>
      <button class="btn" onclick="startAddTournament()" title="新しい大会名を追加">＋</button>
      ${state.tournamentName ? `<button class="btn" onclick="startRenameTournament()" title="この名前を修正">✏️</button>` : ''}
    </div>
  </div>`;
}

function renderLineup(){
  return `
  <div class="screen">
    <div class="header">
      <button class="back" onclick="state.screen='home'; render();">← ホームへ</button>
      <strong style="margin-left:8px;">試合開始設定</strong>
    </div>
    <div class="scroll grow">
      <div class="lineup-top">
        <p class="muted">試合開始前にスターティングメンバー・リベロ・サーブ権を設定してください。ポジションをタップして選手を選びます。</p>

        <div class="row gap16" style="flex-wrap:wrap;">
          ${tournamentPickerHtml()}
        </div>

        <div class="row gap16" style="flex-wrap:wrap;">
          ${teamPickerHtml('home')}
          ${teamPickerHtml('away')}
        </div>

        <div class="row gap16" style="flex-wrap:wrap;">
          <div class="col" style="min-width:220px;">
            <label class="muted">試合形式</label>
            <div class="row gap8">
              <button class="btn ${state.matchFormat==='official'?'primary':''}" onclick="state.matchFormat='official'; render();">公式試合</button>
              <button class="btn ${state.matchFormat==='practice'?'primary':''}" onclick="state.matchFormat='practice'; render();">練習試合</button>
            </div>
          </div>
          <div class="row gap8" style="align-items:center;">
            <span class="muted">相手チームのスタッツも記録する</span>
            <div class="switch ${state.trackOpponentStats?'on':''}" onclick="state.trackOpponentStats=!state.trackOpponentStats; render();"></div>
          </div>
        </div>
        ${!state.trackOpponentStats ? '<p class="muted">オフの場合、相手チームのスタメン6人とリベロ1人は試合開始時に「プレイヤー1」〜「プレイヤー7」として自動で仮設定されます。</p>' : ''}
      </div>

      <div class="lineup-cols">
        <div class="lineup-half">
          ${renderLineupCourt('home', state.homeTeamName)}
          ${state.trackOpponentStats ? renderLineupCourt('away', state.awayTeamName) : ''}
        </div>
        <div class="lineup-half col gap16">
          <div>
            <label class="muted">最初にサーブするチーム</label>
            <div class="serve-cards">
              <button class="serve-card ${state.servingTeam==='home'?'active':''}" onclick="state.servingTeam='home'; render();">🏐<br>${esc(state.homeTeamName)}</button>
              <button class="serve-card ${state.servingTeam==='away'?'active':''}" onclick="state.servingTeam='away'; render();">🏐<br>${esc(state.awayTeamName)}</button>
            </div>
          </div>
          <div class="grow"></div>
          <button class="record-btn" ${canAttemptStart()?'':'disabled'} onclick="startMatch()">試合を開始する</button>
          ${canAttemptStart() ? '' : '<p class="warn-text">両チームの6ポジションすべてに選手を設定してください（自チームは必須、相手チームは記録する設定の場合のみ必須です）。</p>'}
        </div>
      </div>
    </div>
    ${state.lineupPicker ? renderLineupPickerSheet() : ''}
    ${state.lineupLiberoPicker ? renderLineupLiberoPickerSheet() : ''}
    ${state.showLiberoWarning ? renderLiberoWarningOverlay() : ''}
  </div>`;
}

function renderLineupPickerSheet(){
  const {team} = state.lineupPicker;
  const players = currentPlayers(team);
  return `
  <div class="overlay" onclick="if(event.target===this){state.lineupPicker=null; render();}">
    <div class="sheet" style="max-width:420px;">
      <div class="sheet-header"><h2>選手を選択</h2><button class="sheet-close" onclick="state.lineupPicker=null; render();">閉じる</button></div>
      <div class="sheet-body">
        ${players.map(p=>`
          <button class="btn" style="width:100%;text-align:left;margin-bottom:6px;display:flex;justify-content:space-between;"
            onclick="pickLineupPlayer('${p.id}')">
            <span>#${p.number} ${esc(p.name)}</span><span class="muted">${esc(p.position)}</span>
          </button>`).join('')}
      </div>
    </div>
  </div>`;
}
function renderLineupLiberoPickerSheet(){
  const {team} = state.lineupLiberoPicker;
  const players = currentPlayers(team);
  return `
  <div class="overlay" onclick="if(event.target===this){state.lineupLiberoPicker=null; render();}">
    <div class="sheet" style="max-width:420px;">
      <div class="sheet-header"><h2>リベロを選択</h2><button class="sheet-close" onclick="state.lineupLiberoPicker=null; render();">閉じる</button></div>
      <div class="sheet-body">
        ${players.map(p=>`
          <button class="btn" style="width:100%;text-align:left;margin-bottom:6px;display:flex;justify-content:space-between;"
            onclick="pickLineupLiberoPlayer('${p.id}')">
            <span>#${p.number} ${esc(p.name)}</span><span class="muted">${esc(p.position)}</span>
          </button>`).join('')}
      </div>
    </div>
  </div>`;
}
function renderLiberoWarningOverlay(){
  return `
  <div class="overlay">
    <div class="sheet" style="max-width:380px;">
      <div class="sheet-body col gap16" style="text-align:center;">
        <h2>リベロが2名登録されていません</h2>
        <p class="muted">リベロ(L)が2名選ばれていませんが、このまま試合を開始しますか？</p>
        <div class="col gap10">
          <button class="btn primary" onclick="proceedWithoutFullLibero()">このまま開始する</button>
          <button class="btn" onclick="cancelLiberoWarning()">戻って設定する</button>
        </div>
      </div>
    </div>
  </div>`;
}
