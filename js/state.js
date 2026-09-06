/* state.js — 状態管理：定数（プレー種別・ポジションなど）、初期状態、localStorageへの読み書き
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

/* =====================================================================
   vsTOP Webアプリ（バレーボール スタッツ）
   iPad版 (Swift/SwiftUI) の中核機能をブラウザ向けに移植したものです。
   状態は localStorage に保存され、次回訪問時も試合を再開できます。
   ===================================================================== */

const STORAGE_KEY = 'volleyballStatsWebState_v1';

// ---------- プレー種別の定義 ----------
const PLAY_TYPES = {
  serve:        { label:'サーブ',   icon:'🏐', hasCourse:true,  subTypeTitle:'サーブの種類',
    results:[
      {label:'エース', color:'#22c55e', outcome:'acting'},
      {label:'効果あり', color:'#10b981', outcome:'none'},
      {label:'通常', color:'#9aa1ab', outcome:'none'},
      {label:'ミス', color:'#ef4444', outcome:'opponent'},
    ]},
  serveReceive: { label:'キャッチ', icon:'🙌', hasCourse:false,
    results:[
      {label:'Aパス', color:'#22c55e', outcome:'none'},
      {label:'Bパス', color:'#10b981', outcome:'none'},
      {label:'Cパス', color:'#f59e0b', outcome:'none'},
      {label:'ミス', color:'#ef4444', outcome:'opponent'},
    ]},
  receive:      { label:'レシーブ', icon:'☁️', hasCourse:false,
    results:[
      {label:'Aパス', color:'#22c55e', outcome:'none'},
      {label:'Bパス', color:'#10b981', outcome:'none'},
      {label:'Cパス', color:'#f59e0b', outcome:'none'},
      {label:'ミス', color:'#ef4444', outcome:'opponent'},
    ]},
  toss:         { label:'トス',     icon:'☝️', hasCourse:false,
    results:[
      {label:'成功', color:'#22c55e', outcome:'none'},
      {label:'失敗', color:'#f59e0b', outcome:'none'},
      {label:'ミス', color:'#ef4444', outcome:'opponent'},
    ]},
  attack:       { label:'スパイク', icon:'💥', hasCourse:true, subTypeTitle:'攻撃方法',
    subTypes:['スパイク','フェイント','ロール'],
    results:[
      {label:'決定', color:'#22c55e', outcome:'acting'},
      {label:'効果あり', color:'#10b981', outcome:'none'},
      {label:'継続', color:'#3b82f6', outcome:'none'},
      {label:'ミス', color:'#ef4444', outcome:'opponent'},
      {label:'相手ブロック', color:'#9aa1ab', outcome:'opponent'},
    ]},
  block:        { label:'ブロック', icon:'✋', hasCourse:false,
    results:[
      {label:'決定', color:'#22c55e', outcome:'acting'},
      {label:'タッチ', color:'#10b981', outcome:'none'},
      {label:'ミス', color:'#ef4444', outcome:'opponent'},
    ]},
};
const PLAY_ORDER = ['serve','serveReceive','receive','toss','attack','block'];
const COURSES = ['左','中央','右','バック左','バック中央','バック右'];
const POSITIONS = ['OH','OP','MB','S','L','R'];
const ATTACK_TYPES = ['強打','フェイント','ロール'];

// ホームチームのポジション配列（画面左→右）。相手チームは鏡写しなので別配列。
const HOME_FRONT = [3,2,1]; // P4,P3,P2
const HOME_BACK  = [4,5,0]; // P5,P6,P1
const AWAY_FRONT = [1,2,3]; // P2,P3,P4
const AWAY_BACK  = [0,5,4]; // P1,P6,P5


function uid(){ return 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36); }

function defaultPlayers(prefix){
  const names = prefix==='home'
    ? [['山田','OP'],['佐藤','OH'],['鈴木','MB'],['高橋','MB'],['田中','OH'],['伊藤','S'],
       ['渡辺','L'],['中村','OH'],['小林','MB'],['加藤','OP'],['吉田','S'],['山本','L']]
    : null;
  const arr = [];
  for (let i=0;i<12;i++){
    if (names){ arr.push({id:uid(), number:i+1, name:names[i][0], position:names[i][1]}); }
    else { arr.push({id:uid(), number:i+1, name:'相手選手'+(i+1), position:'-'}); }
  }
  return arr;
}

function defaultState(){
  const homePlayers = defaultPlayers('home');
  const awayPlayers = defaultPlayers('away');
  const homeIds = homePlayers.map(p=>p.id);
  const awayIds = awayPlayers.map(p=>p.id);
  return {
    screen:'home',
    homeTeamName:'広島東', awayTeamName:'海風高校', tournamentName:'',
    knownTeamNames:['広島東','海風高校'], knownTournamentNames:[], myTeamName:null,
    teamRosters:{ '広島東':homePlayers, '海風高校':awayPlayers },
    lastLineupByTeamName:{},
    matchFormat:'official', trackOpponentStats:false,
    showCourseSelector:false, showReceiveTab:true, autoRotationEnabled:true, doubleTapToRecordEnabled:true,
    attackComboOptions:['クイック','時間差','レフト','ライト','パイプ'],
    serveTypeOptions:['ジャンプ','フローター','サイド','アンダー'],
    homePlayers, awayPlayers,
    homeRotation:[homeIds[3],homeIds[4],homeIds[1],homeIds[8],homeIds[0],homeIds[5]],
    awayRotation:[awayIds[3],awayIds[4],awayIds[1],awayIds[8],awayIds[0],awayIds[5]],
    homeLiberoSelection:[null,null], awayLiberoSelection:[null,null],
    servingTeam:'home', isRallyInProgress:false, serveReceiveRecorded:false,
    selectedTeam:'home', selectedPlayerId:null, selectedPlayType:'serve',
    selectedResult:null, selectedCourse:null, selectedSubType:null, selectedCombo:null,
    selectedOpponentServeType:null, selectedOpponentAttackType:null,
    currentSet:1, setScores:[{home:0,away:0}], rallyLog:[],
    homeSetsWon:0, awaySetsWon:0, pendingSetResult:null,
    opponentMistakePoints:0, ownMistakePoints:0, lastManualOpponentServeType:null, matchHistory:[], playerNameAliases:{},
    showingStartingLineup:true, matchTab:'entry', activeSheet:null, csvSelectedMatchIds:[],
    lastDblTap:{id:null,t:0},
  };
}

let state = load();

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){}
  return defaultState();
}

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

/* ========================= バックアップ：全データのJSON書き出し・復元 ========================= */

function timestampString(){
  const formatter = new Date();
  const pad = n => String(n).padStart(2,'0');
  return formatter.getFullYear()+pad(formatter.getMonth()+1)+pad(formatter.getDate())+'_'+
    pad(formatter.getHours())+pad(formatter.getMinutes())+pad(formatter.getSeconds());
}

/// 現在までに記録されたプレー総数（アーカイブ済み＋進行中）。バックアップの差分検知に使う簡易指標。
function totalEventFingerprint(){
  const archived = state.matchHistory.reduce((s,m)=>s+m.rallyLog.length, 0);
  return archived + state.rallyLog.length;
}

/// アプリの全データ（試合履歴・選手名簿・設定など）を1つのJSONファイルとして書き出す
function exportAllDataAsJSON(){
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vsTOP_backup_'+timestampString()+'.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  state.lastBackupAt = new Date().toISOString();
  state.lastBackupFingerprint = totalEventFingerprint();
  showToast('バックアップを書き出しました');
  render();
}

/// JSONファイルを選んで全データを復元する（ファイル選択ダイアログはinput要素なのでpromptの問題を受けない）
function triggerImportJSON(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = function(e){
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      try{
        const imported = JSON.parse(ev.target.result);
        state = Object.assign(defaultState(), imported);
        window.state = state;
        save();
        state.activeSheet = null;
        render();
        showToast('データを復元しました');
      }catch(err){
        showToast('JSONファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function render(){ save(); document.getElementById('app').innerHTML = renderScreen(); }

// expose helpers to inline onclick handlers

window.state = state;

/* ========================= ゲームロジック ========================= */

function findPlayer(id, team){
  const list = team==='home' ? state.homePlayers : state.awayPlayers;
  return list.find(p=>p.id===id) || null;
}

function currentPlayers(team){ return team==='home' ? state.homePlayers : state.awayPlayers; }

function currentRotation(team){ return team==='home' ? state.homeRotation : state.awayRotation; }