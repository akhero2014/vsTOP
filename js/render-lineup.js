/* render-lineup.js — 試合開始設定（スタメン・サーブ権・大会名など）画面の描画
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function lineupValid(){
  const homeOk = state.homeRotation.every(Boolean) && new Set(state.homeRotation).size===6;
  if (!state.trackOpponentStats) return homeOk;
  const awayOk = state.awayRotation.every(Boolean) && new Set(state.awayRotation).size===6;
  return homeOk && awayOk;
}

function startMatch(){
  if (!lineupValid()) return;
  state.showingStartingLineup = false;
  render();
}

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

function renderLineupCourt(team, title){
  const front = team==='home' ? HOME_FRONT : AWAY_FRONT;
  const back = team==='home' ? HOME_BACK : AWAY_BACK;
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const filled = rotation.filter(Boolean).length;
  return `
  <div>
    <div class="row" style="justify-content:space-between;margin-bottom:6px;">
      <strong>${esc(title)}</strong>
      <span class="muted">${filled}/6 人設定済み</span>
    </div>
    <div class="mini-court">
      <div class="row gap8" style="margin-bottom:8px;">${front.map(i=>renderLineupSlot(team,i)).join('')}</div>
      <div class="row gap8">${back.map(i=>renderLineupSlot(team,i)).join('')}</div>
    </div>
  </div>`;
}

function renderLineup(){
  const teamNames = orderedTeamNames();
  const teamOptions = teamNames.map(n=>`<option value="${esc(n)}" ${n===state.homeTeamName?'selected':''}>${esc(n)}</option>`).join('');
  const awayOptions = teamNames.map(n=>`<option value="${esc(n)}" ${n===state.awayTeamName?'selected':''}>${esc(n)}</option>`).join('');
  const tOptions = state.knownTournamentNames.map(n=>`<option value="${esc(n)}" ${n===state.tournamentName?'selected':''}>${esc(n)}</option>`).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="back" onclick="state.screen='home'; render();">← ホームへ</button>
      <strong style="margin-left:8px;">試合開始設定</strong>
    </div>
    <div class="scroll grow">
      <div class="lineup-top">
        <p class="muted">試合開始前にスターティングメンバーとサーブ権を設定してください。ポジションをタップして選手を選びます。</p>

        <div class="row gap16" style="flex-wrap:wrap;">
          <div class="col grow" style="min-width:200px;">
            <label class="muted">大会名（任意）</label>
            <select class="field" onchange="handleTournamentSelect(this.value)">
              <option value="">未選択</option>
              ${tOptions}
              <option value="__new__">＋ 新しい大会名を入力</option>
            </select>
          </div>
        </div>

        <div class="row gap16" style="flex-wrap:wrap;">
          <div class="col grow" style="min-width:200px;">
            <label class="muted">自チーム</label>
            <select class="field" onchange="handleTeamNameSelect('home', this.value)">
              ${teamOptions}
              <option value="__new__">＋ 新規チームを入力</option>
            </select>
          </div>
          <div class="col grow" style="min-width:200px;">
            <label class="muted">相手チーム</label>
            <select class="field" onchange="handleTeamNameSelect('away', this.value)">
              ${awayOptions}
              <option value="__new__">＋ 新規チームを入力</option>
            </select>
          </div>
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
          <button class="record-btn" ${lineupValid()?'':'disabled'} onclick="startMatch()">試合を開始する</button>
          ${lineupValid() ? '' : '<p class="warn-text">両チームの6ポジションすべてに選手を設定してください。</p>'}
        </div>
      </div>
    </div>
    ${state.lineupPicker ? renderLineupPickerSheet() : ''}
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

/* ========================= 試合中：ヘッダー ========================= */
