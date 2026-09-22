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
    ]},
    lossOfPoint:  { label:'失点', icon:'📉', hasCourse:false, results:[] },
};
const PLAY_ORDER = ['serve','serveReceive','receive','toss','attack','block','lossOfPoint'];
/// 失点のジャンル。連携ミスのみ複数選手を選択できる
const LOSS_GENRES = ['反則','レシーブミス','連携ミス','その他'];
/// 反則の細分化。その他のみプレイヤー選択が任意（選ばなければチームのミス扱い）
const LOSS_FOUL_DETAILS = ['ネットタッチ','オーバーネット','パッシング','ホールディング','ドリブル','ポジショナルフォルト','その他'];
const COURSES = ['左','中央','右','バック左','バック中央','バック右'];
const POSITIONS = ['OH','OP','MB','S','L','R'];
const ATTACK_TYPES = ['強打','フェイント','ロール'];

// ホームチームのポジション配列（画面左→右）。相手チームは鏡写しなので別配列。
const HOME_FRONT = [3,2,1]; // P4,P3,P2
const HOME_BACK  = [4,5,0]; // P5,P6,P1
const AWAY_FRONT = [1,2,3]; // P2,P3,P4
const AWAY_BACK  = [0,5,4]; // P1,P6,P5


function uid(){ return 'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36); }

/// ポジションごとの表示色。複数ポジション保持時は2色を斜めに分割して表示する
const POSITION_COLORS = { OH:'#3b82f6', OP:'#f97316', MB:'#10b981', S:'#0b1f66', L:'#f59e0b', R:'#a855f7' };

function defaultPlayers(prefix){
  const names = prefix==='home'
    ? [['山田','OP'],['佐藤','OH'],['鈴木','MB'],['高橋','MB'],['田中','OH'],['伊藤','S'],
       ['渡辺','L'],['中村','OH'],['小林','MB'],['加藤','OP'],['吉田','S'],['山本','L']]
    : null;
  const arr = [];
  for (let i=0;i<12;i++){
    if (names){ arr.push({id:uid(), number:i+1, name:names[i][0], positions:[names[i][1]]}); }
    else { arr.push({id:uid(), number:i+1, name:'相手選手'+(i+1), positions:[]}); }
  }
  return arr;
}

/// 新しくチームを登録した時に、選手1〜8を自動で登録しておく（あとで名前・ポジションを編集できる）
function createDefaultRoster(){
  const arr = [];
  for (let i=1;i<=8;i++){
    arr.push({id:uid(), number:i, name:'選手'+i, positions:['OH'], isServeReceiver:false});
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
    showCourseSelector:false, showReceiveTab:false, autoRotationEnabled:true, doubleTapToRecordEnabled:true,
    attackComboOptions:[
      {name:'クイック', category:'クイック'}, {name:'時間差', category:'クイック'},
      {name:'レフト', category:'レフト'}, {name:'ライト', category:'ライト'}, {name:'パイプ', category:'バック'},
    ],
    serveTypeOptions:['ジャンプ','フローター','サイド','アンダー'],
    showTossTab:false, showAttackSubType:false, showAttackEffective:false, showBlockTouch:false,
    homePlayers, awayPlayers,
    homeRotation:[homeIds[3],homeIds[4],homeIds[1],homeIds[8],homeIds[0],homeIds[5]],
    awayRotation:[awayIds[3],awayIds[4],awayIds[1],awayIds[8],awayIds[0],awayIds[5]],
    homeLiberoSelection:[null,null], awayLiberoSelection:[null,null],
    servingTeam:'home', isRallyInProgress:false, serveReceiveRecorded:false,
    selectedTeam:'home', selectedPlayerId:null, selectedPlayType:'serve',
    selectedResult:null, selectedCourse:null, selectedSubType:null, selectedCombo:null,
    selectedOpponentServeType:null, selectedOpponentAttackType:null,
    selectedLossTeam:'home', selectedLossGenre:null, selectedLossDetail:null, selectedLossPlayerIds:[], selectedLossIsTeamMistake:false,
    currentSet:1, setScores:[{home:0,away:0}], rallyLog:[],
    homeSetsWon:0, awaySetsWon:0, pendingSetResult:null,
    opponentMistakePoints:0, ownMistakePoints:0, lastManualOpponentServeType:null, substitutedPlayerIds:[],
    homeStartingLineup:[], awayStartingLineup:[], matchHistory:[], playerNameAliases:{}, teamNameAliases:{},
    showingStartingLineup:true, matchTab:'entry', activeSheet:null, csvSelectedMatchIds:[],
    editingRallyIndex:null, editDraft:null, importProgress:null,
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

function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(err){
    // 容量オーバー等でlocalStorageへの保存に失敗しても、画面の更新自体は止めない。
    // 保存に失敗し続けると次回起動時にデータが失われる可能性があるため、初回だけ知らせる。
    if (!state.saveFailedWarned){
      state.saveFailedWarned = true;
      setTimeout(()=>{ showToast('データの保存に失敗しました（保存容量の上限に達した可能性があります）。「データのバックアップ」から書き出しをおすすめします。'); }, 0);
    }
  }
}

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

/// 以前のバージョンで書き出したバックアップにも対応できるよう、
/// 形式が変わったフィールドをここで今の形に揃えておく（復元直後のクラッシュを防ぐ）
function normalizeImportedState(imported){
  // attackComboOptions: 昔は文字列の配列だった（今は {name, category} の配列）
  if (Array.isArray(imported.attackComboOptions)){
    imported.attackComboOptions = imported.attackComboOptions.map(item=>{
      if (typeof item === 'string') return { name:item, category:'レフト' };
      if (item && typeof item==='object' && item.name) return item;
      return null;
    }).filter(Boolean);
  }
  // 選手のポジション: 昔は position:文字列 だった（今は positions:配列）。playerPositions()で
  // 読み取り自体は互換性があるが、ここでも揃えておくとより安全
  const normalizeRoster = (list)=>{
    if (!Array.isArray(list)) return;
    list.forEach(p=>{
      if (p && !Array.isArray(p.positions)){
        p.positions = (p.position && p.position!=='-') ? [p.position] : [];
      }
    });
  };
  normalizeRoster(imported.homePlayers);
  normalizeRoster(imported.awayPlayers);
  if (imported.teamRosters && typeof imported.teamRosters==='object'){
    Object.keys(imported.teamRosters).forEach(name=>normalizeRoster(imported.teamRosters[name]));
  }
}
function triggerImportJSON(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = function(e){
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    state.importProgress = { loaded:0, total: file.size || 0 };
    render();
    reader.onprogress = function(ev){
      if (ev.lengthComputable){
        state.importProgress = { loaded: ev.loaded, total: ev.total };
        render();
      }
    };
    reader.onload = function(ev){
      state.importProgress = null;
      try{
        const imported = JSON.parse(ev.target.result);
        normalizeImportedState(imported);
        state = Object.assign(defaultState(), imported);
        window.state = state;
        save();
        state.activeSheet = null;
        render();
        showToast('データを復元しました');
      }catch(err){
        render();
        showToast('JSONファイルの読み込みに失敗しました');
      }
    };
    reader.onerror = function(){
      state.importProgress = null;
      render();
      showToast('ファイルの読み込みに失敗しました');
    };
    reader.readAsText(file);
  };
  input.click();
}

function render(){
  save();
  try{
    document.getElementById('app').innerHTML = renderScreen();
  }catch(err){
    // 画面の描画中に何らかの理由でエラーが起きても、画面が二度と更新されなくなる事態だけは避ける。
    // （復元したデータの形式が古い/壊れている場合など）復旧用の簡易画面を出す。
    console.error('画面の描画中にエラーが発生しました:', err);
    try{
      document.getElementById('app').innerHTML = `
        <div style="padding:32px;font-family:sans-serif;">
          <h2 style="color:#b3261e;">画面の表示中にエラーが発生しました</h2>
          <p>保存されているデータの形式に問題がある可能性があります。</p>
          <button style="padding:12px 20px;font-size:16px;margin-top:12px;"
            onclick="if(confirm('保存されているデータを初期状態に戻します。元に戻せません。よろしいですか？')){localStorage.removeItem('${STORAGE_KEY}'); location.reload();}">
            データを初期状態に戻す
          </button>
        </div>`;
    }catch(err2){ /* ここで失敗したらもう打つ手がない */ }
  }
}

// expose helpers to inline onclick handlers

window.state = state;

/* ========================= ゲームロジック ========================= */

function findPlayer(id, team){
  const list = team==='home' ? state.homePlayers : state.awayPlayers;
  return list.find(p=>p.id===id) || null;
}

function currentPlayers(team){ return team==='home' ? state.homePlayers : state.awayPlayers; }

function currentRotation(team){ return team==='home' ? state.homeRotation : state.awayRotation; }