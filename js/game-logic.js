/* game-logic.js — ゲームロジック：ローテーション、得点、サーブ権、プレー記録、undo、セット進行、一時停止/終了
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function clockwiseRotate(arr){
  const copy = arr.slice();
  const first = copy.shift();
  copy.push(first);
  return copy;
}

function rotateTeam(team){
  if (team==='home') state.homeRotation = clockwiseRotate(state.homeRotation);
  else state.awayRotation = clockwiseRotate(state.awayRotation);
}

function manualRotate(team){ rotateTeam(team); refreshServerSelectionIfNeeded(); render(); }

function autoSelectServer(){
  if (state.servingTeam==='away' && !state.trackOpponentStats) return;
  const rotation = currentRotation(state.servingTeam);
  const players = currentPlayers(state.servingTeam);
  const serverId = rotation[0];
  const server = players.find(p=>p.id===serverId);
  if (server){ state.selectedTeam = state.servingTeam; state.selectedPlayerId = server.id; }
}

function autoSelectSetter(){
  if (state.selectedTeam==='away' && !state.trackOpponentStats) return;
  const players = currentPlayers(state.selectedTeam);
  const setter = players.find(p=>p.position==='S');
  if (setter) state.selectedPlayerId = setter.id;
}

function refreshServerSelectionIfNeeded(){
  if (state.selectedPlayType==='serve') autoSelectServer();
}

function visiblePlayTypes(){
  return PLAY_ORDER.filter(type=>{
    if (type==='serve'){
      if (state.isRallyInProgress) return false;
      if (state.servingTeam==='away') return false;
    }
    if (type==='receive' && !state.showReceiveTab) return false;
    if (type==='serveReceive'){
      if (state.servingTeam==='home') return false;
      if (state.serveReceiveRecorded) return false;
    }
    return true;
  });
}

function selectPlayType(type){
  state.selectedPlayType = type;
  state.selectedResult = null; state.selectedCourse = null; state.selectedSubType = null; state.selectedCombo = null;
  state.selectedOpponentServeType = null; state.selectedOpponentAttackType = null;
  if (type==='serve') autoSelectServer();
  if (type==='serveReceive' && state.trackOpponentStats) state.selectedOpponentServeType = lastOpponentServeType();
  if (type==='receive' && state.trackOpponentStats) state.selectedOpponentAttackType = lastOpponentAttackType();
  if (type==='toss') autoSelectSetter();
}

function lastOpponentServeType(){
  const e = state.rallyLog.find(e=>e.team==='away' && e.playType==='serve');
  return e ? e.subType : null;
}

function lastOpponentAttackType(){
  const e = state.rallyLog.find(e=>e.team==='away' && e.playType==='attack');
  return e ? e.subType : null;
}

function canRecord(){
  if (!state.selectedPlayerId || !state.selectedResult) return false;
  const pt = PLAY_TYPES[state.selectedPlayType];
  if (pt.hasCourse && state.showCourseSelector && !state.selectedCourse) return false;
  if (state.selectedPlayType==='serve' && state.serveTypeOptions.length && !state.selectedSubType) return false;
  if (state.selectedPlayType==='attack'){
    if (state.attackComboOptions.length && !state.selectedCombo) return false;
    if (pt.subTypes.length && !state.selectedSubType) return false;
  }
  if (state.selectedPlayType==='serveReceive' && !state.trackOpponentStats){
    if (state.serveTypeOptions.length && !state.selectedOpponentServeType) return false;
  }
  if (state.selectedPlayType==='receive' && !state.trackOpponentStats){
    if (!state.selectedOpponentAttackType) return false;
  }
  return true;
}

function addPoint(team){
  const cur = state.setScores[state.setScores.length-1];
  if (team==='home') cur.home++; else cur.away++;
  checkSetCompletion();
}

function adjustScore(team, delta){
  const cur = state.setScores[state.setScores.length-1];
  if (team==='home') cur.home = Math.max(0, cur.home+delta); else cur.away = Math.max(0, cur.away+delta);
  checkSetCompletion();
  render();
}

function adjustSetsWon(team, delta){
  if (team==='home') state.homeSetsWon = Math.max(0, state.homeSetsWon+delta);
  else state.awaySetsWon = Math.max(0, state.awaySetsWon+delta);
  render();
}

function checkSetCompletion(){
  if (state.pendingSetResult) return;
  const cur = state.setScores[state.setScores.length-1];
  if (cur.home>=25 && cur.home-cur.away>=2){ state.homeSetsWon++; state.pendingSetResult='home'; }
  else if (cur.away>=25 && cur.away-cur.home>=2){ state.awaySetsWon++; state.pendingSetResult='away'; }
}

function handleScoring(winner){
  if (winner===state.servingTeam) return;
  state.servingTeam = winner;
  if (state.autoRotationEnabled) rotateTeam(winner);
  refreshServerSelectionIfNeeded();
}

function recordPlay(){
  if (state.pendingSetResult || !canRecord()) return;
  const player = findPlayer(state.selectedPlayerId, state.selectedTeam);
  if (!player) return;
  const resultOpt = PLAY_TYPES[state.selectedPlayType].results.find(r=>r.label===state.selectedResult);
  const outcome = resultOpt.outcome;

  const snapshot = {
    setScore: Object.assign({}, state.setScores[state.setScores.length-1]),
    homeRotation: state.homeRotation.slice(), awayRotation: state.awayRotation.slice(),
    servingTeam: state.servingTeam, isRallyInProgress: state.isRallyInProgress,
    serveReceiveRecorded: state.serveReceiveRecorded,
  };
  const event = {
    id:uid(), team:state.selectedTeam, playerId:player.id, playerNumber:player.number, playerName:player.name,
    playType:state.selectedPlayType, resultLabel:resultOpt.label, outcome,
    course:(PLAY_TYPES[state.selectedPlayType].hasCourse && state.showCourseSelector) ? state.selectedCourse : null,
    subType: state.selectedSubType,
    combo: state.selectedPlayType==='attack' ? state.selectedCombo : null,
    opponentServeType: state.selectedPlayType==='serveReceive' ? state.selectedOpponentServeType : null,
    opponentAttackType: state.selectedPlayType==='receive' ? state.selectedOpponentAttackType : null,
    setNumber: state.currentSet, snapshot,
  };
  state.rallyLog.unshift(event);

  const wasServe = state.selectedPlayType==='serve';
  const wasServeReceive = state.selectedPlayType==='serveReceive';
  if (wasServe) state.serveReceiveRecorded = false;
  if (wasServeReceive) state.serveReceiveRecorded = true;

  let pointWinner = null;
  if (outcome==='acting'){
    addPoint(state.selectedTeam); handleScoring(state.selectedTeam);
    state.isRallyInProgress=false; pointWinner=state.selectedTeam; state.serveReceiveRecorded=false;
  } else if (outcome==='opponent'){
    const winner = state.selectedTeam==='home' ? 'away':'home';
    addPoint(winner); handleScoring(winner);
    state.isRallyInProgress=false; pointWinner=winner; state.serveReceiveRecorded=false;
  } else {
    if (wasServe) state.isRallyInProgress = true;
  }

  if (pointWinner) selectPlayType(pointWinner==='home' ? 'serve' : 'serveReceive');
  else if (wasServe) selectPlayType('serveReceive');
  else { state.selectedResult=null; state.selectedCourse=null; state.selectedSubType=null; state.selectedCombo=null; }

  render();
}

function handleResultTap(label){
  const now = Date.now();
  const last = state.lastDblTap;
  state.selectedResult = label;
  if (state.doubleTapToRecordEnabled && last.id===label && (now-last.t)<450){
    state.lastDblTap = {id:null,t:0};
    recordPlay();
    return;
  }
  state.lastDblTap = {id:label, t:now};
  render();
}

function undoLast(){
  const last = state.rallyLog.shift();
  if (!last) { render(); return; }
  state.setScores[state.setScores.length-1] = last.snapshot.setScore;
  state.homeRotation = last.snapshot.homeRotation;
  state.awayRotation = last.snapshot.awayRotation;
  state.servingTeam = last.snapshot.servingTeam;
  state.isRallyInProgress = last.snapshot.isRallyInProgress;
  state.serveReceiveRecorded = last.snapshot.serveReceiveRecorded;
  render();
}

function adjustOpponentMistakePoints(delta){
  if (state.pendingSetResult) { render(); return; }
  if (delta>0){
    for (let i=0;i<delta;i++){ state.opponentMistakePoints++; addPoint('home'); handleScoring('home'); }
    selectPlayType('serve');
  } else {
    const reduce = Math.min(-delta, state.opponentMistakePoints);
    if (reduce>0){ state.opponentMistakePoints -= reduce; adjustScoreSilent('home', -reduce); }
  }
  render();
}

function adjustScoreSilent(team, delta){
  const cur = state.setScores[state.setScores.length-1];
  if (team==='home') cur.home = Math.max(0, cur.home+delta); else cur.away = Math.max(0, cur.away+delta);
  checkSetCompletion();
}

function setServingTeam(team){ state.servingTeam = team; refreshServerSelectionIfNeeded(); render(); }

function continueToNextSet(){ state.pendingSetResult=null; state.showingStartingLineup=false; startNewSet(); render(); }

function startNewSet(){
  state.currentSet++; state.setScores.push({home:0,away:0});
  state.isRallyInProgress=false; state.serveReceiveRecorded=false; selectPlayType('serve');
}

function archiveCurrentMatchIfNeeded(){
  if (state.rallyLog.length===0) return;
  state.matchHistory.unshift({
    id:uid(), date:new Date().toISOString(), tournamentName:state.tournamentName,
    homeTeamName:state.homeTeamName, awayTeamName:state.awayTeamName,
    setScores:JSON.parse(JSON.stringify(state.setScores)), rallyLog:JSON.parse(JSON.stringify(state.rallyLog)),
    matchFormat:state.matchFormat,
    homeOpponentErrors: state.trackOpponentStats ? opponentErrorsBenefiting('home') : state.opponentMistakePoints,
  });
}

function resetMatchState(){
  state.currentSet=1; state.setScores=[{home:0,away:0}]; state.rallyLog=[];
  state.opponentMistakePoints=0; state.homeSetsWon=0; state.awaySetsWon=0; state.pendingSetResult=null;
  state.isRallyInProgress=false; state.serveReceiveRecorded=false; selectPlayType('serve');
}

function resetForNewGame(){ archiveCurrentMatchIfNeeded(); resetMatchState(); state.showingStartingLineup=true; render(); }

function returnToHomeScreenReset(){ archiveCurrentMatchIfNeeded(); resetMatchState(); state.screen='home'; render(); }

function pauseAndReturnHome(){ state.screen='home'; render(); }

function endCurrentGame(){
  archiveCurrentMatchIfNeeded(); resetMatchState(); state.screen='home'; render();
}

function hasPausedGame(){ return !state.showingStartingLineup; }

function opponentErrorsBenefiting(team){
  const opp = team==='home' ? 'away' : 'home';
  return state.rallyLog.filter(e=>e.team===opp && e.outcome==='opponent').length;
}

/* ========================= 選手・チーム管理 ========================= */
