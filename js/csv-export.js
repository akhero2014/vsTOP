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
  shareOrSaveCsvFiles([{ filename: filename+'.csv', content: lines.join('\n') }], { zipName: filename });
}

/* =====================================================================
   ZIP書庫の作成（外部ライブラリ不使用の最小実装、圧縮なしのSTORE方式）。
   選手ごとに1ファイルずつ共有・ダウンロードする方式は、iOS Safariでは
   「複数ファイルの一括フォルダ保存」も「連続した個別ダウンロード」もどちらも
   信頼性が低く、一部の選手のファイルだけが保存されない/ダウンロードされない
   ことがある。1つのZIPファイルにまとめれば「保存」の操作は1回で済み、
   ファイルが欠けることもない。
   ===================================================================== */

function crc32(bytes){
  if (!crc32.table){
    const table = [];
    for (let n=0;n<256;n++){
      let c = n;
      for (let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xFFFFFFFF;
  for (let i=0;i<bytes.length;i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ bytes[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function concatUint8Arrays(arrays){
  let total = 0;
  arrays.forEach(a=>{ total += a.length; });
  const out = new Uint8Array(total);
  let off = 0;
  arrays.forEach(a=>{ out.set(a, off); off += a.length; });
  return out;
}

/// fileSpecs: [{filename, content(文字列, BOM付きなど込みで渡す)}] → ZIPファイルのバイト列(Uint8Array)を返す
function buildZipBytes(fileSpecs){
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  fileSpecs.forEach(f=>{
    const nameBytes = encoder.encode(f.filename);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8ファイル名フラグ
    lv.setUint16(8, 0, true);      // 圧縮方式=0（無圧縮）
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const localHeaderOffset = offset;
    localParts.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, localHeaderOffset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
  });

  const centralDirStart = offset;
  let centralDirSize = 0;
  centralParts.forEach(p=>{ centralDirSize += p.length; });

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, fileSpecs.length, true);
  ev.setUint16(10, fileSpecs.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirStart, true);
  ev.setUint16(20, 0, true);

  return concatUint8Arrays([...localParts, ...centralParts, eocd]);
}

/* =====================================================================
   ファイルの保存方法について。
   iPadOS Safari は File System Access API (showDirectoryPicker /
   showSaveFilePicker) に対応していない。そのため、iPadで最も確実に
   「ファイルに保存」できる方法として Web Share API を最優先で使う。
   1. Web Share API（files対応）… iPad/iPhoneのSafariで動作。1ファイルなら
      共有シートから直接「ファイルに保存」できる。
   2. File System Access API … Chrome/Edge等デスクトップ対応ブラウザ。
   3. <a download> … 上記どちらも使えない場合の最終手段（1ファイルのみなら
      Safariでも問題なく動作する）。
   ===================================================================== */

async function shareOrSaveSingleFile(filename, bytes, mimeType){
  if (navigator.canShare){
    try{
      const file = new File([bytes], filename, {type: mimeType});
      if (navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file] });
        showToast('書き出しました。共有シートから保存先を選んでください。');
        return;
      }
    }catch(err){
      if (err && err.name==='AbortError') return;
    }
  }

  if (window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      showToast('保存しました：'+filename);
      return;
    }catch(err){
      if (err && err.name==='AbortError') return;
    }
  }

  const blob = new Blob([bytes], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('ダウンロードしました：'+filename);
}

/// fileSpecs: [{filename, content}]。複数ファイルなら1つのZIPにまとめて
/// 保存の確実性を優先する。1ファイルだけならそのままCSVとして保存する。
async function shareOrSaveCsvFiles(fileSpecs, options){
  options = options || {};
  if (fileSpecs.length===0){ showToast('出力できるデータがありません'); return; }

  if (fileSpecs.length===1){
    const bytes = new TextEncoder().encode("\uFEFF"+fileSpecs[0].content);
    await shareOrSaveSingleFile(fileSpecs[0].filename, bytes, 'text/csv');
    return;
  }

  const zipBytes = buildZipBytes(fileSpecs.map(f => ({ filename:f.filename, content:"\uFEFF"+f.content })));
  const zipName = (options.zipName || 'csv_export') + '.zip';
  await shareOrSaveSingleFile(zipName, zipBytes, 'application/zip');
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
  await shareOrSaveCsvFiles(fileSpecs, { zipName: teamName.replace(/[\/:]/g,'_')+'_選手別CSV' });
}

/// 常にダウンロードしたい場合の明示的な選択肢。複数ファイルの場合も1つのZIPに
/// まとめてダウンロードする（個別に何度もダウンロードする方式はSafari等で
/// 一部のファイルが欠けることがあるため使わない）。
function exportDetailedCSV(matchIds, teamName){
  const matches = collectMatchesForExport(matchIds);
  if (matches.length===0){ showToast('試合を選択してください'); return; }
  const names = collectPlayerNamesForMatches(matches, teamName);
  const fileSpecs = names.map(name => {
    const body = buildPlayerCsvForMatches(matches, name, teamName);
    return body ? { filename: name.replace(/[\/:]/g,'_')+'.csv', content: body } : null;
  }).filter(Boolean);
  if (fileSpecs.length===0){ showToast('出力できるデータがありません'); return; }

  if (fileSpecs.length===1){
    const blob = new Blob(["\uFEFF"+fileSpecs[0].content], {type:'text/csv;charset=utf-8;'});
    downloadBlob(blob, fileSpecs[0].filename);
  } else {
    const zipBytes = buildZipBytes(fileSpecs.map(f => ({ filename:f.filename, content:"\uFEFF"+f.content })));
    downloadBlob(new Blob([zipBytes], {type:'application/zip'}), teamName.replace(/[\/:]/g,'_')+'_選手別CSV.zip');
  }
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('ダウンロードしました：'+filename);
}

