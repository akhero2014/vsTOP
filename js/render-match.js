/* render-match.js — 試合中の画面の描画：ヘッダー・コート図・プレー入力・ラリー履歴・選手一覧タブ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function renderHeader(){
  const cur = state.setScores[state.setScores.length-1];
  return `
  <div class="header">
    <button class="back" onclick="pauseAndReturnHome()">← ホームへ</button>
    <div class="score-block">
      <div class="team-label"><span class="dot"></span>${esc(state.homeTeamName)}</div>
      ${renderScoreStepper('home', cur.home)}
      ${state.matchFormat==='official' ? `
        <div class="set-pill">${state.currentSet}セット目<br>(${state.homeSetsWon}-${state.awaySetsWon})</div>
      ` : ''}
      ${renderScoreStepper('away', cur.away)}
      <div class="team-label"><span class="dot outline"></span>${esc(state.awayTeamName)}</div>
    </div>
    <div class="header-icons">
      <button onclick="openSheet('settings')"><span class="ic">⚙️</span>設定</button>
      <button onclick="openSheet('stats')"><span class="ic">📊</span>スタッツ</button>
      <button onclick="openSheet('menu')"><span class="ic">☰</span>メニュー</button>
    </div>
  </div>`;
}

function renderScoreStepper(team, value){
  return `
  <div class="score-stepper">
    <div class="score-num">${value}</div>
    <div class="score-btns">
      <button onclick="adjustScore('${team}',-1)">➖</button>
      <button onclick="adjustScore('${team}',1)">➕</button>
    </div>
  </div>`;
}

/* ========================= 試合中：コート ========================= */

function positionCircleHtml(team, index){
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const players = currentPlayers(team);
  const player = players.find(p=>p.id===rotation[index]);
  const isSelected = state.selectedTeam===team && player && state.selectedPlayerId===player.id;
  const disabled = !player || (team==='away' && !state.trackOpponentStats);
  const setterCls = player && player.position==='S' ? 'setter' : '';
  return `
    <button class="pos-circle ${team==='away'?'away':''} ${setterCls} ${isSelected?'selected':''} ${!player?'empty':''}"
      ${disabled?'disabled style="opacity:.5"':''} onclick="selectCourtPlayer('${team}','${player?player.id:''}')">
      <div class="circ">${player?player.number:'-'}</div>
      <div class="lab">P${index+1}</div>
    </button>`;
}

function liberoBadgeHtml(team, index, label){
  const l = liberos(team);
  const player = l[index];
  const isSelected = state.selectedTeam===team && player && state.selectedPlayerId===player.id;
  const disabled = !player || (team==='away' && !state.trackOpponentStats);
  return `
    <button class="pos-circle ${team==='away'?'away':''} ${isSelected?'selected':''} ${!player?'empty':''}"
      style="width:44px" ${disabled?'disabled style="opacity:.5"':''} onclick="selectCourtPlayer('${team}','${player?player.id:''}')">
      <div class="circ" style="width:40px;height:40px;background:${player?'#f59e0b':'rgba(255,255,255,.25)'}">${player?player.number:'-'}</div>
      <div class="lab">${label}</div>
    </button>`;
}

function selectCourtPlayer(team, playerId){
  if (!playerId) return;
  if (team==='away' && !state.trackOpponentStats) return;
  state.selectedTeam = team; state.selectedPlayerId = playerId;
  render();
}

function renderTeamBlock(team, nearNetFirst){
  const front = team==='home' ? HOME_FRONT : AWAY_FRONT;
  const back = team==='home' ? HOME_BACK : AWAY_BACK;
  const firstRow = nearNetFirst ? front : back;
  const secondRow = nearNetFirst ? back : front;
  const l1 = liberoBadgeHtml(team, 0, 'L1');
  const l2 = liberoBadgeHtml(team, 1, 'L2');
  const liberoCol = team==='home'
    ? `<div class="libero-col">${nearNetFirst? l2+l1 : l1+l2}</div>`
    : `<div class="libero-col">${nearNetFirst? l2+l1 : l1+l2}</div>`;
  const grid = `
    <div class="court-grid">
      <div class="court-row">${firstRow.map(i=>positionCircleHtml(team,i)).join('')}</div>
      <div class="court-row">${secondRow.map(i=>positionCircleHtml(team,i)).join('')}</div>
    </div>`;
  return `<div class="team-block">${team==='home' ? liberoCol+grid : grid+liberoCol}</div>`;
}

function renderCourt(){
  return `
  <div class="col gap10">
    <div class="court-box">
      <div class="team-header dim">${esc(state.awayTeamName)} ${state.servingTeam==='away'?'<span class=\"serve-dot\"></span> サーブ権':''}</div>
      ${renderTeamBlock('away', false)}
      <div class="net-divider"><span>ネット</span></div>
      ${renderTeamBlock('home', true)}
      <div class="team-header">${esc(state.homeTeamName)} ${state.servingTeam==='home'?'<span class=\"serve-dot\"></span> サーブ権':''}</div>
    </div>

    <div class="serve-toggle-row">
      <span class="muted">サーブ権</span>
      <button class="pill-btn ${state.servingTeam==='home'?'active':''}" onclick="setServingTeam('home')">${esc(state.homeTeamName)}</button>
      <button class="pill-btn ${state.servingTeam==='away'?'active':''}" onclick="setServingTeam('away')">${esc(state.awayTeamName)}</button>
    </div>

    <div class="row gap8">
      <button class="btn grow" onclick="manualRotate('home')">🔄 ${esc(state.homeTeamName)}を回転</button>
      <button class="btn grow" ${state.trackOpponentStats?'':'disabled'} onclick="manualRotate('away')">🔄 ${esc(state.awayTeamName)}を回転</button>
    </div>
    <button class="btn" onclick="openSheet('substitution')">🔁 メンバーチェンジ</button>
    <button class="btn" ${state.rallyLog.length?'':'disabled'} onclick="undoLast()">↩️ 1つ戻る</button>

    ${!state.trackOpponentStats ? `
      <div class="opp-mistake-row">
        <span class="grow">相手のミスによる得点：${state.opponentMistakePoints} 回</span>
        <button onclick="adjustOpponentMistakePoints(-1)">➖</button>
        <button onclick="adjustOpponentMistakePoints(1)">➕</button>
      </div>` : ''}
  </div>`;
}

/* ========================= 試合中：プレー入力 ========================= */

function renderMatchTabs(){
  return `
  <div class="tabbar">
    <button class="${state.matchTab==='roster'?'active':''}" onclick="state.matchTab='roster'; render();">選手一覧</button>
    <button class="${state.matchTab==='entry'?'active':''}" onclick="state.matchTab='entry'; render();">プレー入力</button>
    <button class="${state.matchTab==='history'?'active':''}" onclick="state.matchTab='history'; render();">ラリー履歴</button>
  </div>`;
}

function renderRosterTab(){
  const team = state.rosterTeam || 'home';
  const disabledAway = !state.trackOpponentStats;
  const players = currentPlayers(team);
  return `
  <div class="card scroll">
    <div class="row gap8" style="margin-bottom:10px;">
      <button class="btn ${team==='home'?'primary':''}" onclick="state.rosterTeam='home'; render();">${esc(state.homeTeamName)}</button>
      <button class="btn ${team==='away'?'primary':''}" onclick="state.rosterTeam='away'; render();">${esc(state.awayTeamName)}</button>
    </div>
    ${(team==='away' && disabledAway) ? '<p class="muted">相手チームのスタッツ記録がオフのため選択できません（メニューから変更できます）</p>' : players.map(p=>`
      <button class="btn" style="width:100%;text-align:left;margin-bottom:6px;display:flex;justify-content:space-between;
        ${(state.selectedPlayerId===p.id && state.selectedTeam===team) ? 'background:var(--blue);color:#fff;' : ''}"
        onclick="selectCourtPlayer('${team}','${p.id}')">
        <span>#${p.number} ${esc(p.name)}</span>
        <span class="${(state.selectedPlayerId===p.id && state.selectedTeam===team)?'':'muted'}">${esc(p.position)}</span>
      </button>`).join('')}
  </div>`;
}

function choiceSectionHtml(title, options, selected, onPick){
  return `
  <div class="col gap8">
    <div class="choice-title">${esc(title)}</div>
    <div class="choice-grid">
      ${options.map(o=>`<button class="choice-btn ${selected===o?'active':''}" onclick="${onPick}('${esc(o).replace(/'/g,"\\'")}')">${esc(o)}</button>`).join('')}
    </div>
    ${options.length===0?'<div class="muted">設定から追加できます</div>':''}
  </div>`;
}

function pickCourse(v){ state.selectedCourse = state.selectedCourse===v ? null : v; render(); }

function pickSubType(v){ state.selectedSubType = state.selectedSubType===v ? null : v; render(); }

function pickCombo(v){ state.selectedCombo = state.selectedCombo===v ? null : v; render(); }

function pickOppServe(v){ state.selectedOpponentServeType = state.selectedOpponentServeType===v ? null : v; render(); }

function pickOppAttack(v){ state.selectedOpponentAttackType = state.selectedOpponentAttackType===v ? null : v; render(); }

function renderPlayEntry(){
  const visible = visiblePlayTypes();
  const pt = PLAY_TYPES[state.selectedPlayType];
  const player = state.selectedPlayerId ? findPlayer(state.selectedPlayerId, state.selectedTeam) : null;

  let extra = '';
  if (pt.hasCourse && state.showCourseSelector){
    extra += choiceSectionHtml('コースを選択', COURSES, state.selectedCourse, 'pickCourse');
  }
  if (state.selectedPlayType==='serveReceive'){
    extra += state.trackOpponentStats
      ? `<div class="col gap8"><div class="choice-title">相手のサーブ種類（自動取得）</div><div class="auto-fetch">${esc(state.selectedOpponentServeType||'記録なし')}</div></div>`
      : choiceSectionHtml('相手のサーブ種類', state.serveTypeOptions, state.selectedOpponentServeType, 'pickOppServe');
  }
  if (state.selectedPlayType==='receive'){
    extra += state.trackOpponentStats
      ? `<div class="col gap8"><div class="choice-title">相手の攻撃種類（自動取得）</div><div class="auto-fetch">${esc(state.selectedOpponentAttackType||'記録なし')}</div></div>`
      : choiceSectionHtml('相手の攻撃種類', ATTACK_TYPES, state.selectedOpponentAttackType, 'pickOppAttack');
  }
  if (state.selectedPlayType==='attack'){
    extra += choiceSectionHtml('コンビネーション', state.attackComboOptions, state.selectedCombo, 'pickCombo');
  }
  if (state.selectedPlayType==='serve'){
    extra += choiceSectionHtml('サーブの種類', state.serveTypeOptions, state.selectedSubType, 'pickSubType');
  } else if (pt.subTypes){
    extra += choiceSectionHtml('攻撃方法', pt.subTypes, state.selectedSubType, 'pickSubType');
  }

  const can = canRecord();

  return `
  <div class="card col gap16 scroll">
    <div class="play-tabs">
      ${visible.map(t=>`
        <button class="play-tab ${state.selectedPlayType===t?'active':''}" onclick="selectPlayType('${t}'); render();">
          <span class="ic">${PLAY_TYPES[t].icon}</span>${esc(PLAY_TYPES[t].label)}
        </button>`).join('')}
    </div>

    <div class="selected-player-row">
      ${player ? `<div class="num">${player.number}</div><strong>${esc(player.name)}</strong><span class="muted">${esc(player.position)}</span>`
                : '<span class="muted">選手を選択してください（コート図・選手一覧から）</span>'}
      <span class="grow"></span>
    </div>

    ${extra}

    <div class="col gap8">
      <div class="choice-title">${esc(pt.label)}の結果を選択</div>
      <div class="result-grid">
        ${pt.results.map(r=>`
          <button class="result-btn" style="background:${state.selectedResult===r.label?r.color:r.color+'33'};
            color:${state.selectedResult===r.label?'#fff':r.color};"
            onclick="handleResultTap('${r.label}')">${esc(r.label)}</button>`).join('')}
      </div>
      ${state.doubleTapToRecordEnabled ? '<div class="muted">結果をすばやく2回タップすると即座に記録されます</div>' : ''}
    </div>

    <button class="record-btn" ${can?'':'disabled'} onclick="recordPlay()">このプレーを記録する</button>
    ${(state.selectedResult && !can) ? '<div class="warn-text">結果以外の選択項目もすべて選んでください</div>' : ''}
  </div>`;
}

/* ========================= 試合中：ラリー履歴 ========================= */

function renderHistory(){
  const rows = state.rallyLog.map(e=>`
    <div class="history-row">
      <span class="team-chip" style="background:${e.team==='home'?'#3b82f6':'#9aa1ab'}"></span>
      <span style="width:22px;">${e.playerNumber}</span>
      <span style="width:64px;">${esc(PLAY_TYPES[e.playType].label)}</span>
      <span class="grow"></span>
      <span class="history-badge" style="background:${resultColorFor(e)}22;color:${resultColorFor(e)}">${esc(e.resultLabel)}</span>
    </div>`).join('');
  return `
  <div class="card scroll">
    <h3 style="margin-bottom:8px;">ラリー履歴</h3>
    ${rows || '<p class="muted">まだ記録がありません</p>'}
  </div>`;
}

function resultColorFor(e){
  const r = PLAY_TYPES[e.playType].results.find(r=>r.label===e.resultLabel);
  return r ? r.color : '#9aa1ab';
}

/* ========================= 試合中：画面全体 ========================= */

function renderMatch(){
  if (state.showingStartingLineup) return renderLineup();
  let html = '<div class="screen">';
  html += renderHeader();
  html += '<div class="match-body">';
  html += '<div class="col-court">'+renderCourt()+'</div>';
  html += '<div class="col-main">'+renderMatchTabs()+matchTabContent()+'</div>';
  html += '</div></div>';
  if (state.pendingSetResult) html += renderSetCompletionOverlay();
  return html;
}

function matchTabContent(){
  if (state.matchTab==='roster') return renderRosterTab();
  if (state.matchTab==='history') return renderHistory();
  return renderPlayEntry();
}

function renderSetCompletionOverlay(){
  const winner = state.pendingSetResult;
  const winnerName = winner==='home' ? state.homeTeamName : state.awayTeamName;
  return `
  <div class="overlay">
    <div class="sheet" style="max-width:380px;">
      <div class="sheet-body col gap16" style="text-align:center;">
        <h2>セット終了</h2>
        <p>${esc(winnerName)}が第${state.currentSet}セットを獲得しました。</p>
        <div class="col gap10">
          ${state.matchFormat==='official' ? `<button class="btn primary" onclick="continueToNextSet()">次のセットを記録する</button>` : ''}
          <button class="btn danger" onclick="returnToHomeScreenReset()">ホーム画面に戻る</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ========================= シート（設定・メニュー・スタッツ・記録・準備・交代） ========================= */
