/* csv-export.js — CSV出力：選手別スタッツの簡易CSV、および詳細な試合別CSV（フォルダ/個別ダウンロード）
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function csvEscape(text){
  text = String(text);
  if (text.includes(',')||text.includes('"')||text.includes('\n')) return '"'+text.replace(/"/g,'""')+'"';
  return text;
}

function fmt(v, digits){ return v===null||v===undefined ? '' : v.toFixed(digits===undefined?1:digits); }

function simpleStatsCSV(rows, filename){
  const lines = ['#,選手名,出場セット数,スパイク本数,スパイク決定率(%),サーブ本数,サーブ効果率(%),キャッチ本数,キャッチAパス率(%),ブロック本数'];
  for (const r of rows){
    lines.push([
      r.player.number, csvEscape(r.player.name), r.setsParticipated,
      r.spikeOverall.total, fmt(r.spikeOverall.decisionRate),
      r.serve.total, fmt(r.serve.effectiveRate),
      r.serveReceiveOverall.total, fmt(r.serveReceiveOverall.aPassRate),
      r.block.decided,
    ].join(','));
  }
  shareOrSaveCsvFiles([{ filename: filename+'.csv', content: lines.join('\n') }]);
}

function downloadText(text, filename){
  const blob = new Blob(["\uFEFF"+text], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =====================================================================
   CSVの保存方法について。
   iPadOS Safari は File System Access API (showDirectoryPicker) に対応して
   おらず、また <a download> + Blob URL の組み合わせも挙動が不安定なことが
   知られている。そのため、iPadで最も確実に「ファイルに保存」できる方法として
   Web Share API（navigator.share にファイルを渡し、共有シートから
   「ファイルに保存」を選んでもらう）を最優先で使う。
   1. Web Share API（files対応）… iPad/iPhoneのSafariで動作
   2. File System Access API（showDirectoryPicker）… Chrome/Edge等のデスクトップ
   3. 個別ダウンロード（<a download>）… 上記どちらも使えない場合の最終手段
   ===================================================================== */

async function shareOrSaveCsvFiles(fileSpecs, options){
  options = options || {};
  const allowFolderPicker = options.allowFolderPicker !== false;

  if (fileSpecs.length===0){ showToast('出力できるデータがありません'); return; }

  // 1. Web Share API
  if (navigator.canShare){
    try{
      const files = fileSpecs.map(f => new File(["\uFEFF"+f.content], f.filename, {type:'text/csv'}));
      if (navigator.canShare({ files })){
        await navigator.share({ files });
        showToast(files.length+'件のCSVを共有しました');
        return;
      }
    }catch(err){
      if (err && err.name==='AbortError') return; // 共有をキャンセルした場合は何もしない
      // 共有に失敗した場合は次の方法へフォールバックする
    }
  }

  // 2. File System Access API（対応ブラウザのみ）
  if (allowFolderPicker && window.showDirectoryPicker){
    try{
      const dirHandle = await window.showDirectoryPicker();
      for (const f of fileSpecs){
        const fileHandle = await dirHandle.getFileHandle(f.filename, {create:true});
        const writable = await fileHandle.createWritable();
        await writable.write("\uFEFF"+f.content);
        await writable.close();
      }
      showToast(fileSpecs.length+'件のCSVをフォルダに保存しました。');
      return;
    }catch(err){
      if (err && err.name==='AbortError') return;
      // フォルダ保存に失敗した場合は個別ダウンロードへフォールバックする
    }
  }

  // 3. 個別ダウンロード（最終フォールバック）
  fileSpecs.forEach(f => downloadText(f.content, f.filename));
  showToast(fileSpecs.length>1 ? 'お使いの環境ではまとめて保存できないため、個別ファイルとしてダウンロードしました。' : 'ダウンロードしました。');
}

function detailedMatchCSV(match, playerName, side){
  const events = match.rallyLog.filter(e=>e.team===side && (state.playerNameAliases[e.playerName]||e.playerName)===playerName);
  if (events.length===0) return '';
  let out = '';
  out += '試合日,'+new Date(match.date).toLocaleDateString('ja-JP')+'\n';
  if (match.tournamentName) out += '大会名,'+csvEscape(match.tournamentName)+'\n';
  out += '対象チーム,'+csvEscape(side==='home'?match.homeTeamName:match.awayTeamName)+'\n';
  out += '自チーム,'+csvEscape(match.homeTeamName)+'\n';
  out += '相手チーム,'+csvEscape(match.awayTeamName)+'\n';
  out += '試合形式,'+(match.matchFormat==='official'?'公式試合':'練習試合')+'\n';
  out += match.matchFormat==='official' ? ('記録セット数,'+match.setScores.length+'\n') : '備考,1セットのみの記録\n';
  out += '\n';

  const attacks = events.filter(e=>e.playType==='attack');
  if (attacks.length){
    out += '【スパイク（総合）】\n総数,決定本数,ミス数,決定率\n';
    out += attacks.length+','+attacks.filter(e=>e.resultLabel==='決定').length+','+attacks.filter(e=>e.outcome==='opponent').length+',\n\n';
    const combos = [...new Set(attacks.map(e=>e.combo).filter(Boolean))].sort();
    if (combos.length){
      out += '【スパイク（コンビ別）】\nコンビ,総数,決定本数,ミス数,決定率\n';
      combos.forEach(c=>{
        const g = attacks.filter(e=>e.combo===c);
        out += csvEscape(c)+','+g.length+','+g.filter(e=>e.resultLabel==='決定').length+','+g.filter(e=>e.outcome==='opponent').length+',\n';
      });
      out += '\n';
    }
  }
  const serves = events.filter(e=>e.playType==='serve');
  if (serves.length){
    out += '【サーブ】\n総数,決定本数,効果本数,ミス数,効果率\n';
    out += serves.length+','+serves.filter(e=>e.resultLabel==='エース').length+','+serves.filter(e=>e.resultLabel==='効果あり').length+','+serves.filter(e=>e.resultLabel==='ミス').length+',\n\n';
  }
  const tosses = events.filter(e=>e.playType==='toss');
  if (tosses.length){
    out += '【トス】\nトス本数,成功数,失敗数,ミス数,成功率\n';
    out += tosses.length+','+tosses.filter(e=>e.resultLabel==='成功').length+','+tosses.filter(e=>e.resultLabel==='失敗').length+','+tosses.filter(e=>e.resultLabel==='ミス').length+',\n\n';
  }
  const srs = events.filter(e=>e.playType==='serveReceive');
  if (srs.length){
    out += '【キャッチ（総合）】\n総数,Aパス数,Bパス数,Cパス数,Aパス率\n';
    out += srs.length+','+srs.filter(e=>e.resultLabel==='Aパス').length+','+srs.filter(e=>e.resultLabel==='Bパス').length+','+srs.filter(e=>e.resultLabel==='Cパス').length+',\n\n';
    const types = [...new Set(srs.map(e=>e.opponentServeType).filter(Boolean))].sort();
    if (types.length){
      out += '【キャッチ（相手サーブ種類別）】\n相手サーブ種類,総数,Aパス数,Bパス数,Cパス数,Aパス率\n';
      types.forEach(t=>{
        const g = srs.filter(e=>e.opponentServeType===t);
        out += csvEscape(t)+','+g.length+','+g.filter(e=>e.resultLabel==='Aパス').length+','+g.filter(e=>e.resultLabel==='Bパス').length+','+g.filter(e=>e.resultLabel==='Cパス').length+',\n';
      });
      out += '\n';
    }
  }
  const recs = events.filter(e=>e.playType==='receive');
  if (recs.length){
    out += '【レシーブ（総合）】\n総数,Aパス数,Bパス数,Cパス数,Aパス率\n';
    out += recs.length+','+recs.filter(e=>e.resultLabel==='Aパス').length+','+recs.filter(e=>e.resultLabel==='Bパス').length+','+recs.filter(e=>e.resultLabel==='Cパス').length+',\n\n';
    const types = [...new Set(recs.map(e=>e.opponentAttackType).filter(Boolean))].sort();
    if (types.length){
      out += '【レシーブ（相手攻撃種類別）】\n相手攻撃種類,総数,Aパス数,Bパス数,Cパス数,Aパス率\n';
      types.forEach(t=>{
        const g = recs.filter(e=>e.opponentAttackType===t);
        out += csvEscape(t)+','+g.length+','+g.filter(e=>e.resultLabel==='Aパス').length+','+g.filter(e=>e.resultLabel==='Bパス').length+','+g.filter(e=>e.resultLabel==='Cパス').length+',\n';
      });
      out += '\n';
    }
  }
  const blocks = events.filter(e=>e.playType==='block');
  if (blocks.length){
    out += '【ブロック】\nブロック決定本数,セットあたりのブロック数\n';
    out += blocks.filter(e=>e.resultLabel==='決定').length+',\n\n';
  }
  return out;
}

function collectMatchesForExport(matchIds){
  const matches = [];
  const current = currentAsMatchRecord();
  if (current && matchIds.includes('current')) matches.push(current);
  state.matchHistory.forEach(m=>{ if (matchIds.includes(m.id)) matches.push(m); });
  return matches;
}

function collectPlayerNamesForMatches(matches, teamName){
  const names = []; const seen = new Set();
  matches.forEach(m=>{
    const side = sideForTeamInMatch(m, teamName);
    if (!side) return;
    m.rallyLog.forEach(e=>{
      if (e.team!==side) return;
      const n = state.playerNameAliases[e.playerName]||e.playerName;
      if (!seen.has(n)){ seen.add(n); names.push(n); }
    });
  });
  return names;
}

function buildPlayerCsvForMatches(matches, name, teamName){
  let matchNum = 0; let body = '';
  matches.forEach(m=>{
    const side = sideForTeamInMatch(m, teamName);
    if (!side) return;
    const section = detailedMatchCSV(m, name, side);
    if (section){ matchNum++; body += '【第'+matchNum+'試合】\n'+section; }
  });
  if (!body) return null;
  body += '【計算式】\n項目,計算式\nサーブ効果率,"((サーブ決定本数×100)+(サーブ効果本数×25)-(サーブミス数×25))÷サーブ総数"\n';
  return body;
}

/// 選択した試合・チームについて、選手ごとのCSVをまとめて書き出す（保存方法は自動選択）
async function exportDetailedCSVSmart(matchIds, teamName){
  const matches = collectMatchesForExport(matchIds);
  if (matches.length===0){ showToast('試合を選択してください'); return; }
  const names = collectPlayerNamesForMatches(matches, teamName);
  const fileSpecs = names.map(name => {
    const body = buildPlayerCsvForMatches(matches, name, teamName);
    return body ? { filename: name.replace(/[\/:]/g,'_')+'.csv', content: body } : null;
  }).filter(Boolean);
  await shareOrSaveCsvFiles(fileSpecs);
}

/// 常に個別ファイルとしてダウンロードしたい場合の明示的な選択肢
function exportDetailedCSV(matchIds, teamName){
  const matches = collectMatchesForExport(matchIds);
  if (matches.length===0){ showToast('試合を選択してください'); return; }
  const names = collectPlayerNamesForMatches(matches, teamName);
  names.forEach(name=>{
    const body = buildPlayerCsvForMatches(matches, name, teamName);
    if (body) downloadText(body, name.replace(/[\/:]/g,'_')+'.csv');
  });
}

