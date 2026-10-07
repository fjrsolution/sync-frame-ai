(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const API = '/api';
  const CANVAS_PRESETS = [
    {value:'1920x1080', label:'16:9 · Full HD', width:1920, height:1080},
    {value:'1280x720', label:'16:9 · HD', width:1280, height:720},
    {value:'3840x2160', label:'16:9 · 4K', width:3840, height:2160},
    {value:'1080x1920', label:'9:16 · Vertical', width:1080, height:1920},
    {value:'1080x1080', label:'1:1 · Square', width:1080, height:1080},
    {value:'1080x1350', label:'4:5 · Portrait', width:1080, height:1350},
    {value:'1440x1080', label:'4:3 · Classic', width:1440, height:1080},
  ];
  const DEFAULT_TRACKS = [
    {id:'video',kind:'image',code:'V1',label:'Visual / Gambar'},
    {id:'narration',kind:'narration',code:'A1',label:'Narasi / Voice'},
    {id:'music',kind:'audio',code:'A2',label:'Musik'},
    {id:'subtitle',kind:'text',code:'S1',label:'Caption / Subtitle'},
  ];

  const state = {
    project: null,
    selected: null,
    selectedTrack: 'video',
    selectedClips: [],
    clipboard: [],
    assetKind: 'images',
    zoomPct: 100,
    basePixelsPerSecond: 20,
    pixelsPerSecond: 20,
    playhead: 0,
    history: [],
    historyIndex: -1,
    historyLock: false,
    dirty: false,
    saveTimer: null,
    wave: null,
    renderJob: null,
    previewRAF: null,
    previewAssetId: null,
    previewVideoAssetId: null,
    selectedVideoShotId: null,
    organizerAsset: null,
    silentPlayback: null,
    mixAudios: new Map(),
  };
  const voicePreviewAudio = new Audio();
  let voicePreviewAssetId = null;
  let aiSetupResolve = null;
  let aiSetupPollTimer = null;

  function updateVoicePreviewButtons(){qsa('.voice-preview').forEach(button=>{const playing=button.dataset.assetId===voicePreviewAssetId&&!voicePreviewAudio.paused;button.classList.toggle('playing',playing);button.title=playing?'Pause voice preview':'Play voice preview';button.setAttribute('aria-label',button.title);button.innerHTML=`<i class="bi ${playing?'bi-pause-fill':'bi-play-fill'}"></i>`;});}
  function stopVoicePreview(){voicePreviewAudio.pause();voicePreviewAudio.removeAttribute('src');voicePreviewAudio.load();voicePreviewAssetId=null;updateVoicePreviewButtons();}
  function toggleVoicePreview(asset){
    stopPreviewPlayback();$('playPauseBtn').innerHTML='<i class="bi bi-play-fill"></i>';
    if(voicePreviewAssetId===asset.id){if(voicePreviewAudio.paused){voicePreviewAudio.play().then(updateVoicePreviewButtons).catch(error=>toast(error.message,4000));}else{voicePreviewAudio.pause();updateVoicePreviewButtons();}return;}
    voicePreviewAudio.src=asset.source;voicePreviewAssetId=asset.id;voicePreviewAudio.currentTime=0;
    voicePreviewAudio.play().then(updateVoicePreviewButtons).catch(error=>{stopVoicePreview();toast(error.message,4000);});
  }
  voicePreviewAudio.addEventListener('ended',()=>{voicePreviewAssetId=null;updateVoicePreviewButtons();});

  function toast(msg, ms = 2200) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function renderAiSetup(status){
    const progress=Math.max(0,Math.min(100,Number(status.progress)||0));
    $('aiSetupMessage').textContent=status.message||'Menyiapkan AI lokal…';
    $('aiSetupProgress').style.width=`${progress}%`;$('aiSetupProgress').textContent=`${progress}%`;
    $('aiSetupProgress').classList.toggle('progress-bar-animated',status.status==='running');
    $('aiSetupModels').innerHTML=(status.models||[]).map(model=>{
      const value=model.status||'pending';
      const icon=value==='ready'?'bi-check-circle-fill':value==='failed'?'bi-x-circle-fill':value==='downloading'?'bi-arrow-repeat':'bi-circle';
      const label={ready:'Siap',failed:'Gagal',downloading:'Memeriksa / menyiapkan',pending:'Menunggu'}[value]||value;
      return `<div class="ai-setup-model"><i class="bi ${icon} status-${value}"></i><div><div>${escapeHtml(model.label||model.id)}</div><small>${escapeHtml(model.model||'')}</small></div><span class="small status-${value}">${label}</span></div>`;
    }).join('');
    const failed=status.status==='failed';
    $('aiSetupActions').classList.toggle('d-none',!failed);
    $('aiSetupError').classList.toggle('d-none',!failed);
    $('aiSetupError').textContent=failed?`${status.error||'Download gagal.'} Periksa internet lalu tekan Coba Lagi. Mode terbatas tetap bisa dipakai, tetapi hasil sync kurang akurat.`:'';
  }

  async function pollAiSetup(){
    clearTimeout(aiSetupPollTimer);
    try{
      const status=await api(`${API}/ai/setup`);renderAiSetup(status);
      if(status.status==='completed'){
        bootstrap.Modal.getOrCreateInstance($('aiSetupModal')).hide();
        const resolve=aiSetupResolve;aiSetupResolve=null;if(resolve)resolve(false);return;
      }
      if(status.status==='failed')return;
      aiSetupPollTimer=setTimeout(pollAiSetup,700);
    }catch(error){renderAiSetup({status:'failed',progress:0,error:error.message,models:[]});}
  }

  async function startAiSetup(force=false){
    $('aiSetupActions').classList.add('d-none');$('aiSetupError').classList.add('d-none');
    try{renderAiSetup(await api(`${API}/ai/setup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force})}));pollAiSetup();}
    catch(error){renderAiSetup({status:'failed',progress:0,error:error.message,models:[]});}
  }

  async function ensureLocalAi(){
    const status=await api(`${API}/ai/setup`);
    if(status.ready)return false;
    renderAiSetup(status);bootstrap.Modal.getOrCreateInstance($('aiSetupModal')).show();
    return new Promise(resolve=>{aiSetupResolve=resolve;if(status.status!=='failed')startAiSetup(false);});
  }

  function fmt(sec) {
    sec = Math.max(0, Number(sec) || 0);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }

  function deepClone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid(prefix='id') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
  function clipDuration(c) { return Math.max(0, (Number(c.end)||0) - (Number(c.start)||0)); }
  function isIntroClip(c){return !!c&&c.type==='video'&&c.metadata?.role==='intro';}
  function introClip(){return (state.project?.timeline?.tracks?.video||[]).find(isIntroClip)||null;}
  function currentTrack() { return state.project?.timeline?.tracks?.[state.selectedTrack] || []; }
  function getSelectedClip() { return currentTrack().find(c => c.id === state.selected) || null; }
  function trackDefinitions(){return [...DEFAULT_TRACKS,...(state.project?.ui?.extra_tracks||[])];}
  function trackDefinition(id){return trackDefinitions().find(track=>track.id===id)||{id,kind:'image',code:id,label:id};}
  function trackKind(id){return trackDefinition(id).kind;}
  function selectedKey(track,id){return `${track}:${id}`;}
  function isSelected(track,id){return state.selectedClips.includes(selectedKey(track,id))||(state.selected===id&&state.selectedTrack===track);}
  function selectedEntries(){return state.selectedClips.map(key=>{const cut=key.indexOf(':');return {track:key.slice(0,cut),id:key.slice(cut+1)};}).filter(entry=>findClip(entry.track,entry.id));}
  function visibleTrack(id){return state.project?.ui?.track_visibility?.[id]!==false;}
  function audibleTrack(id){const tracks=trackDefinitions().filter(track=>['audio','narration'].includes(track.kind));const solo=tracks.filter(track=>state.project?.ui?.track_solo?.[track.id]);return visibleTrack(id)&&(!solo.length||solo.some(track=>track.id===id));}
  function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||0));}
  function textBaseY(caption){return caption?.subtitle_position==='top'?15:caption?.subtitle_position==='center'?50:85;}
  function canvasPreset(value) { return CANVAS_PRESETS.find(preset => preset.value === value) || CANVAS_PRESETS[0]; }
  function captionOutputFontSize(caption) {
    const preset = canvasPreset(state.project?.timeline?.settings?.resolution);
    const baseSize = Math.max(12, Math.min(120, Number(caption?.font_size) || 42));
    return baseSize * Math.min(preset.width, preset.height) / 1080;
  }

  function populateCanvasControls() {
    const options = CANVAS_PRESETS.map(preset => `<option value="${preset.value}">${preset.label} · ${preset.value}</option>`).join('');
    $('canvasResolution').innerHTML = options;
    $('renderResolution').innerHTML = options;
  }

  function fitPreviewCanvas() {
    const wrap = $('previewCanvasWrap'), stage = $('previewStage');
    if (!wrap || !stage) return;
    const preset = canvasPreset(state.project?.timeline?.settings?.resolution);
    const style = getComputedStyle(wrap);
    const availableWidth = Math.max(1, wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    const availableHeight = Math.max(1, wrap.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    const aspect = preset.width / preset.height;
    let width = availableWidth, height = width / aspect;
    if (height > availableHeight) { height = availableHeight; width = height * aspect; }
    stage.style.width = `${Math.floor(width)}px`;
    stage.style.height = `${Math.floor(height)}px`;
    stage.style.aspectRatio = `${preset.width} / ${preset.height}`;
    updateSubtitlePreviewScale();
  }

  function updateSubtitlePreviewScale() {
    const stage = $('previewStage');if(!stage)return;
    const preset = canvasPreset(state.project?.timeline?.settings?.resolution);
    const scale = Math.min(stage.clientWidth / preset.width, stage.clientHeight / preset.height);
    if(!Number.isFinite(scale)||scale<=0)return;
    qsa('.subtitle-overlay',$('textOverlayLayer')).forEach(overlay=>{const outputFontSize=Number(overlay.dataset.outputFontSize||0);if(outputFontSize)overlay.style.fontSize=`${outputFontSize*scale}px`;});
  }

  function setCanvasResolution(value, saveChange=false) {
    const preset = canvasPreset(value);
    if (state.project) state.project.timeline.settings.resolution = preset.value;
    $('canvasResolution').value = preset.value;
    $('renderResolution').value = preset.value;
    document.documentElement.style.setProperty('--canvas-aspect', String(preset.width / preset.height));
    requestAnimationFrame(fitPreviewCanvas);
    if (saveChange && state.project) {
      markDirty(true, `Canvas ${preset.label}`);
      toast(`Canvas ${preset.label} (${preset.value})`);
    }
  }

  function sanitizeProject(p) {
    p.timeline ||= {duration:0,tracks:{video:[],narration:[],music:[],subtitle:[]},settings:{}};
    p.timeline.tracks ||= {};
    for (const k of ['video','narration','music','subtitle']) p.timeline.tracks[k] ||= [];
    p.timeline.settings ||= {};
    p.timeline.settings.resolution = canvasPreset(p.timeline.settings.resolution).value;
    p.ui ||= {};
    p.ui.extra_tracks = (p.ui.extra_tracks||[]).filter(track=>track&&track.id&&['image','audio','text'].includes(track.kind));
    const trackLabels={image:'Visual / Gambar',audio:'Audio',text:'Text Overlay'};let textTrackNumber=0;for(const track of p.ui.extra_tracks){track.label=trackLabels[track.kind];if(track.kind==='text')track.code=`T${++textTrackNumber}`;}
    if(p.ui.dynamic_tracks_version!==2){
      const emptyLegacyTracks=new Set(p.ui.extra_tracks.filter(track=>!(p.timeline.tracks[track.id]||[]).length).map(track=>track.id));
      p.ui.extra_tracks=p.ui.extra_tracks.filter(track=>!emptyLegacyTracks.has(track.id));
      for(const id of emptyLegacyTracks){delete p.timeline.tracks[id];delete p.ui.track_visibility?.[id];delete p.ui.track_solo?.[id];delete p.ui.track_volume?.[id];}
      p.ui.dynamic_tracks_version=2;
    }
    p.ui.track_visibility ||= {};
    p.ui.track_solo ||= {};
    p.ui.track_volume ||= {};
    for(const track of [...DEFAULT_TRACKS,...p.ui.extra_tracks]){
      p.timeline.tracks[track.id] ||= [];
      if(p.ui.track_visibility[track.id]==null)p.ui.track_visibility[track.id]=true;
      if(p.ui.track_volume[track.id]==null&&['audio','narration'].includes(track.kind))p.ui.track_volume[track.id]=Number(p.timeline.tracks[track.id][0]?.volume??(track.id==='music'?.1:1));
    }
    // Voice Sequence is the only user-facing audio mode. This also migrates
    // projects saved by older versions in the legacy single-audio mode.
    p.ui.narration_mode = 'sequence';
    if(!['id','en','zh','ko'].includes(p.ui.narration_language))p.ui.narration_language='id';
    if(p.ui.caption_enabled==null)p.ui.caption_enabled=false;
    p.ui.markers=(p.ui.markers||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    p.ui.loop_range ||= {in:0,out:Math.max(0,Number(p.timeline.duration)||0),enabled:false};
    p.ui.loop_range.in=clamp(p.ui.loop_range.in,0,p.timeline.duration||0);
    p.ui.loop_range.out=clamp(p.ui.loop_range.out||p.timeline.duration,0,p.timeline.duration||0);
    if(p.ui.loop_range.out<=p.ui.loop_range.in)p.ui.loop_range.enabled=false;
    for (const caption of p.timeline.tracks.subtitle) caption.caption_style ||= p.ui.caption_style || 'classic';
    p.assets ||= {images:[],videos:[],audio:[],music:[],intro:[],subtitles:[]};
    for (const k of ['images','videos','audio','music','intro','subtitles']) p.assets[k] ||= [];
    for(const items of Object.values(p.assets))for(const asset of items){asset.metadata||={};asset.metadata.folder||='';asset.metadata.tags=Array.isArray(asset.metadata.tags)?asset.metadata.tags:[];asset.metadata.color||='#5b8def';}
    const audioIds=new Set(p.assets.audio.map(asset=>asset.id));
    p.ui.narration_sequence_ids=(p.ui.narration_sequence_ids||[]).filter(id=>audioIds.has(id));
    for(const asset of p.assets.audio)if(!p.ui.narration_sequence_ids.includes(asset.id))p.ui.narration_sequence_ids.push(asset.id);
    return p;
  }

  function snapshot(label='Edit') {
    if (!state.project || state.historyLock) return;
    const snap = JSON.stringify({
      name:state.project.name,
      timeline:state.project.timeline,
      ui:state.project.ui,
      assets:state.project.assets,
      asset_order:Object.fromEntries(Object.entries(state.project.assets||{}).map(([kind,items])=>[kind,items.map(item=>item.id)])),
    });
    if (state.history[state.historyIndex]?.data === snap) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({label, data:snap});
    if (state.history.length > 80) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedo();
  }

  function restoreHistory(index) {
    if (index < 0 || index >= state.history.length || !state.project) return;
    state.historyLock = true;
    const restored = JSON.parse(state.history[index].data);
    state.project.name = restored.name;
    state.project.timeline = restored.timeline;
    state.project.ui = restored.ui;
    if(restored.assets)state.project.assets=restored.assets;
    for(const [kind,order] of Object.entries(restored.asset_order||{})){
      const items=state.project.assets?.[kind]||[],rank=new Map(order.map((id,pos)=>[id,pos]));
      items.sort((a,b)=>(rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER));
    }
    sanitizeProject(state.project);
    state.historyIndex = index;
    state.selected = null;state.selectedClips=[];
    state.historyLock = false;
    updateUndoRedo();
    markDirty(false);
    renderAll();updateProjectTitle();
  }

  function undo() { if (state.historyIndex > 0) restoreHistory(state.historyIndex - 1); }
  function redo() { if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1); }
  function updateUndoRedo() {
    $('undoBtn').disabled = state.historyIndex <= 0;
    $('redoBtn').disabled = state.historyIndex >= state.history.length - 1;
  }

  function markDirty(pushHistory=false, label='Edit') {
    state.dirty = true; $('saveState').textContent = 'Unsaved';
    if (pushHistory) snapshot(label);
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveProject, 3500);
  }

  async function api(url, options={}) {
    const r = await fetch(url, options);
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`;
      try { const j = await r.json(); msg = j.detail || msg; } catch {}
      throw new Error(msg);
    }
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json') ? r.json() : r.text();
  }

  async function saveProject() {
    if (!state.project || !state.dirty) return;
    $('saveState').textContent = 'Saving…';
    try {
      state.project.name = $('projectName').value.trim() || 'Untitled Project';
      await api(`${API}/projects/${state.project.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(state.project)
      });
      state.dirty = false; $('saveState').textContent = 'Saved';
      loadRecentProjects();
    } catch (e) { $('saveState').textContent = 'Save failed'; toast(e.message); }
  }

  function saveProjectBeforeExit() {
    if (!state.project || !state.dirty) return;
    state.project.name = $('projectName').value.trim() || 'Untitled Project';
    const body = JSON.stringify(state.project);
    const queued = navigator.sendBeacon?.(
      `${API}/projects/${state.project.id}/autosave`,
      new Blob([body], {type:'application/json'})
    );
    if (!queued) {
      fetch(`${API}/projects/${state.project.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body, keepalive:true
      }).catch(()=>{});
    }
  }

  async function createProject(name='Untitled Project') {
    const p = await api(`${API}/projects`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    await openProject(p.id);
  }

  async function openProject(id) {
    stopVoicePreview();
    try {
      state.project = sanitizeProject(await api(`${API}/projects/${id}`));
      localStorage.setItem('framesync-project', id);
      $('projectName').value = state.project.name;
      $('autoSyncDuration').value = state.project.ui.auto_sync_mode==='manual'?String(state.project.ui.auto_sync_seconds||6):'auto';
      state.selected = null; state.selectedTrack = 'video'; state.selectedClips=[]; state.playhead = 0;
      state.history=[]; state.historyIndex=-1; snapshot('Open project'); state.dirty=false; $('saveState').textContent='Saved';
      renderAll(); loadRecentProjects();
    } catch (e) { toast(e.message); }
  }

  async function loadRecentProjects() {
    try {
      const projects = await api(`${API}/projects`);
      $('recentProjects').innerHTML = projects.map(p => `
        <div class="project-card" data-project-id="${p.id}">
          <div class="project-card-copy"><strong>${escapeHtml(p.name)}</strong><small>${fmt(p.duration)} · ${p.scenes} scenes</small></div>
          <button class="project-delete" type="button" title="Delete project" aria-label="Delete ${escapeHtml(p.name)}"><i class="bi bi-trash3"></i></button>
        </div>`).join('') || '<div class="text-secondary small">No recent projects.</div>';
      qsa('.project-card').forEach(el => {
        el.onclick = () => openProject(el.dataset.projectId);
        el.querySelector('.project-delete').onclick = event => {
          event.stopPropagation();
          const project = projects.find(item => item.id === el.dataset.projectId);
          if (project) deleteProject(project);
        };
      });
    } catch {}
  }

  async function deleteProject(project) {
    if (!confirm(`Delete project "${project.name}"? All uploaded media and timeline data in this project will be permanently removed.`)) return;
    try {
      await api(`${API}/projects/${project.id}`, {method:'DELETE'});
      const wasActive = state.project?.id === project.id;
      if (wasActive) {
        clearTimeout(state.saveTimer);
        state.project = null; state.dirty = false; state.selected = null; state.selectedClips = [];
        localStorage.removeItem('framesync-project');
        const remaining = await api(`${API}/projects`);
        if (remaining.length) await openProject(remaining[0].id);
        else await createProject('My Video Project');
      } else {
        await loadRecentProjects();
      }
      toast(`Project "${project.name}" deleted.`);
    } catch (error) {
      toast(error.message, 5000);
    }
  }

  function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  async function bootstrapApp() {
    await loadRecentProjects();
    const last = localStorage.getItem('framesync-project');
    if (last) {
      try { await openProject(last); return; } catch {}
    }
    const all = await api(`${API}/projects`);
    if (all.length) await openProject(all[0].id); else await createProject('My Video Project');
  }

  function renderAll() {
    if (!state.project) return;
    setCanvasResolution(state.project.timeline.settings.resolution); renderAssets(); renderScenes(); renderTimeline(); renderInspector(); renderCaptionState(); renderAutoSceneControl(); renderReviewLowState(); renderPlaybackControls(); syncAudioSource(); updatePreview(state.playhead); updateProjectTitle();
  }
  function renderReviewLowState(){const count=lowReviewRows().length,button=$('reviewLowBtn');$('reviewLowCount').textContent=String(count);button.disabled=count===0;}
  function renderCaptionState(){const captions=state.project?.timeline?.tracks?.subtitle||[],toggle=$('captionEnabledToggle'),enabled=!!captions.length&&state.project.ui.caption_enabled===true,track=$('track-subtitle');toggle.disabled=!captions.length;toggle.checked=enabled;if(track)track.classList.toggle('captions-disabled',!enabled);toggle.parentElement.title=captions.length?'Show captions in preview and rendered video':'Press Auto Caption to generate captions first.';}
  function estimatedAutoSceneSeconds(){const images=state.project?.assets?.images?.length||0,videoShots=(state.project?.assets?.videos||[]).reduce((sum,asset)=>sum+(asset.metadata?.shots||[]).filter(shot=>shot.enabled!==false).length,0),visuals=images+videoShots;if(!visuals)return 6;const audio=state.project.assets.audio||[],ids=state.project.ui.narration_sequence_ids||[],selected=ids.map(id=>audio.find(asset=>asset.id===id)).filter(Boolean);const duration=selected.reduce((sum,asset)=>sum+(Number(asset.duration)||0),0)||(Number(state.project.timeline.duration)||0);return Math.max(2,Math.min(20,duration/visuals||6));}
  function renderAutoSceneControl(){const option=$('autoSyncDuration').querySelector('option[value="auto"]');if(option)option.textContent=`Auto (~${estimatedAutoSceneSeconds().toFixed(1)}s)`;$('narrationLanguage').value=state.project.ui.narration_language||'id';const mode=state.project.ui.alignment_mode||'legacy';$('alignmentMode').value=['coverage','storyboard'].includes(mode)?mode:'legacy';$('autoSyncDuration').disabled=['sentence','storyboard','coverage'].includes(mode);}
  function selectedSceneSeconds(){const value=$('autoSyncDuration').value;return ['sentence','storyboard','coverage'].includes(state.project.ui.alignment_mode)||value==='auto'?null:Math.max(2,Math.min(20,Number(value)||6));}

  let storyboardData={rows:[],unused:[]};
  let transcriptDrafts=new Map();
  async function openStoryboard(){
    if(!state.project)return;
    stopPreviewPlayback();
    await saveProject();if(state.dirty)return;
    transcriptDrafts=new Map();
    $('storyboardTranscript').replaceChildren();
    const voices=state.project.assets.audio||[];
    $('storyboardScriptVoice').innerHTML=voices.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name||a.id)}</option>`).join('');
    loadStoryboardScript();
    try{storyboardData=await api(`${API}/projects/${state.project.id}/storyboard`);renderStoryboard();bootstrap.Modal.getOrCreateInstance($('storyboardModal')).show();}
    catch(error){toast(error.message,5000);}
  }
  function renderStoryboard(){
    qsa('#storyboardTranscript textarea').forEach(el=>{const index=Number(el.id.replace('transcript-edit-',''));if(el.value!==(state.project.transcript[index]?.text||''))transcriptDrafts.set(index,el.value);});
    $('storyboardStatus').textContent=storyboardData.stale?'Transkrip berubah. Jalankan Auto Sync untuk memperbarui pasangan.':'';
    const rows=storyboardData.rows.filter(row=>!$('storyboardLowOnly').checked||row.confidence==='LOW');
    $('storyboardRows').innerHTML=rows.map(row=>`<article class="storyboard-row" data-row-id="${escapeHtml(row.id)}">
      <img loading="lazy" src="${escapeHtml(row.source)}" alt="Visual terpilih" onerror="this.style.visibility='hidden'">
      <div><strong>${fmt(row.start)}–${fmt(row.end)} · ${escapeHtml(row.confidence)}</strong><p>${escapeHtml(row.text||'')}</p><p class="small text-secondary">${escapeHtml(row.reason||'')}</p>
      <button class="btn btn-sm btn-outline-light storyboard-jump">Lihat di timeline</button>
      ${row.kind==='image'?'<button class="btn btn-sm btn-outline-info storyboard-description">Deskripsi foto</button>':''}
      <div class="storyboard-alternatives">${(row.suggestions||[]).map((s,i)=>`<button class="btn btn-sm btn-outline-secondary storyboard-use" data-candidate="${escapeHtml(s.visual_candidate_id||s.asset_id)}" ${row.manual?'title="Mengubah pilihan manual"':''}><img loading="lazy" src="${escapeHtml(s.source)}" alt="">Alternatif ${i+1} · ${s.match_percent??Math.round(s.score*100)}%</button>`).join('')}</div></div></article>`).join('')||'<p>Tidak ada kalimat untuk ditampilkan. Jalankan Auto Sync terlebih dahulu.</p>';
    $('storyboardUnused').innerHTML=(storyboardData.unused||[]).map(a=>`<p class="small"><strong>${escapeHtml(a.name)}</strong> — ${escapeHtml(a.reason)}</p>`).join('')||'<p class="small">Tidak ada laporan aset tersisa.</p>';
    $('storyboardTranscript').innerHTML=(state.project.transcript||[]).map((s,i)=>`<div class="mb-3"><label class="small" for="transcript-edit-${i}">${fmt(s.start)}–${fmt(s.end)}</label><textarea id="transcript-edit-${i}" class="form-control" maxlength="4000">${escapeHtml(s.text||'')}</textarea><button class="btn btn-sm btn-outline-info transcript-save" data-index="${i}">Simpan teks</button></div>`).join('');
    qsa('.storyboard-jump').forEach(button=>button.onclick=()=>{const row=storyboardData.rows.find(r=>r.id===button.closest('[data-row-id]').dataset.rowId);bootstrap.Modal.getOrCreateInstance($('storyboardModal')).hide();selectClip('video',row.clip_id);seekTo(row.start);});
    qsa('.storyboard-description').forEach(button=>button.onclick=()=>{const row=storyboardData.rows.find(r=>r.id===button.closest('[data-row-id]').dataset.rowId),asset=state.project.assets.images.find(a=>a.id===row.asset_id);if(asset){bootstrap.Modal.getOrCreateInstance($('storyboardModal')).hide();showImagePreview(asset);}});
    qsa('.storyboard-use').forEach(button=>button.onclick=()=>storyboardMutation(button,'storyboard/replace','POST',{row_id:button.closest('[data-row-id]').dataset.rowId,candidate_id:button.dataset.candidate}));
    qsa('.transcript-save').forEach(button=>button.onclick=()=>storyboardMutation(button,'transcript','PATCH',{index:Number(button.dataset.index),text:$(`transcript-edit-${button.dataset.index}`).value}));
    transcriptDrafts.forEach((text,index)=>{const el=$(`transcript-edit-${index}`);if(el)el.value=text;});
  }
  function loadStoryboardScript(){const id=$('storyboardScriptVoice').value;$('storyboardScript').value=state.project.ui.storyboard_scripts?.[id]||'';$('storyboardScript').disabled=!id;}
  async function storyboardMutation(button,path,method,payload){
    const controls=qsa('button,textarea',$('storyboardModal'));controls.forEach(el=>el.disabled=true);
    try{
      await saveProject();if(state.dirty)throw new Error('Simpan project dahulu.');
      state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/${path}`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
      state.dirty=false;snapshot('Storyboard correction');renderAll();
      if(path==='transcript')transcriptDrafts.delete(payload.index);
      storyboardData=await api(`${API}/projects/${state.project.id}/storyboard`);renderStoryboard();
      toast(path==='transcript'?'Teks disimpan. Jalankan Auto Sync lagi.':'Pasangan disimpan sebagai edit manual.',4000);
    }catch(error){toast(error.message,5000);}finally{controls.forEach(el=>el.disabled=false);}
  }
  function updateProjectTitle(){ $('projectName').value = state.project?.name || 'Untitled Project'; }

  function renderAssets() {
    const term = $('assetSearch').value.trim().toLowerCase();
    const folder=$('assetFolderFilter').value,unusedOnly=$('assetUnusedOnly').checked;
    const sequenceMode=state.assetKind==='audio';
    $('audioModeControls').classList.toggle('d-none',state.assetKind!=='audio');
    $('imageOrderHint').classList.toggle('d-none',state.assetKind!=='images');
    $('introHint').classList.toggle('d-none',state.assetKind!=='intro');
    $('audioModeHint').textContent='Semua voice diputar berurutan. Geser kartu untuk mengubah urutannya.';
    let arr = state.project?.assets?.[state.assetKind] || [];
    const visualItems=state.assetKind==='images'?arr.map(asset=>asset.metadata||{}):state.assetKind==='videos'?arr.flatMap(asset=>asset.metadata?.shots||[]):[];
    const failedVisuals=visualItems.filter(item=>item.ai_caption_status==='failed'||item.ai_caption_error).length;
    const analyzedVisuals=visualItems.filter(item=>String(item.ai_caption||'').trim()).length;
    const analysisStatus=$('visualAnalysisStatus');analysisStatus.classList.toggle('d-none',!visualItems.length);analysisStatus.classList.toggle('d-block',!!visualItems.length);
    analysisStatus.textContent=`Pemahaman AI: ${analyzedVisuals}/${visualItems.length}${failedVisuals?` · ${failedVisuals} gagal. Buka preview untuk coba lagi.`:''}`;
    if(sequenceMode){const order=state.project.ui.narration_sequence_ids||[];arr=[...arr].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));}
    const folders=[...new Set(arr.map(asset=>asset.metadata?.folder).filter(Boolean))].sort();
    $('assetFolderFilter').innerHTML='<option value="">Semua folder</option>'+folders.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');$('assetFolderFilter').value=folders.includes(folder)?folder:'';
    const used=new Set(trackDefinitions().flatMap(track=>(state.project.timeline.tracks[track.id]||[]).flatMap(clip=>[clip.metadata?.asset_id,clip.source])).filter(Boolean));
    $('assetGrid').innerHTML = arr.filter(a => (!folder||a.metadata?.folder===folder)&&(!unusedOnly||(!used.has(a.id)&&!used.has(a.source)))&&`${a.name} ${a.description||''} ${a.prompt||''} ${a.metadata?.user_description||''} ${(a.metadata?.sync_cues||[]).join(' ')} ${(a.metadata?.tags||[]).join(' ')} ${a.metadata?.folder||''}`.toLowerCase().includes(term)).map(a => {
      const img = state.assetKind === 'images' ? `<img src="${a.preview || a.source}" alt="">` : ['videos','intro'].includes(state.assetKind) ? `<video src="${a.source}" muted playsinline preload="metadata"></video>` : `<div class="asset-type-icon"><i class="bi ${state.assetKind==='music'?'bi-music-note-beamed':'bi-soundwave'}"></i></div>`;
      const sequenceIndex=sequenceMode?(state.project.ui.narration_sequence_ids.indexOf(a.id)+1):state.assetKind==='images'?(state.project.assets.images.indexOf(a)+1):0;
      const badge = sequenceIndex?`<span class="sequence-index">${sequenceIndex}</span>`:'';
      const canDelete=['images','videos','audio','music','intro'].includes(state.assetKind);
      const previewButton=['images','videos'].includes(state.assetKind)?`<button class="asset-preview" type="button" title="${state.assetKind==='videos'?'Preview dan edit shot video':'Lihat gambar ukuran besar'}" aria-label="Preview asset"><i class="bi ${state.assetKind==='videos'?'bi-film':'bi-arrows-fullscreen'}"></i></button>`:'';
      const voicePreviewButton=state.assetKind==='audio'?`<button class="voice-preview" type="button" draggable="false" data-asset-id="${a.id}" title="Play voice preview" aria-label="Play voice preview"><i class="bi bi-play-fill"></i></button>`:'';
      const organizeButton=state.assetKind!=='intro'?'<button class="asset-organize" type="button" title="Atur folder, tag, dan warna" aria-label="Atur aset"><i class="bi bi-tags"></i></button>':'';
      const meta=[a.metadata?.folder,...(a.metadata?.tags||[]).slice(0,2)].filter(Boolean).map(value=>`<span>${escapeHtml(value)}</span>`).join('');
      return `<div class="asset-card ${sequenceMode||state.assetKind==='images'?'sequence-item':''}" style="--asset-color:${escapeHtml(a.metadata?.color||'#5b8def')}" draggable="${state.assetKind!=='intro'}" data-asset-id="${a.id}" data-kind="${state.assetKind}">${badge}${canDelete?`<button class="asset-delete" type="button" title="Hapus ${escapeHtml(a.name)}" aria-label="Hapus ${escapeHtml(a.name)}"><i class="bi bi-trash3"></i></button>`:''}${organizeButton}${previewButton}${voicePreviewButton}${img}<div class="asset-name">${['videos','intro'].includes(state.assetKind)?'<i class="bi bi-film"></i> ':''}${escapeHtml(a.name)}</div>${meta?`<div class="asset-meta">${meta}</div>`:''}</div>`;
    }).join('');
    qsa('.asset-card').forEach(el => {
      el.addEventListener('dragstart', ev => {
        if(el.dataset.kind==='intro'){ev.preventDefault();return;}
        ev.dataTransfer.setData('application/json', JSON.stringify({assetId:el.dataset.assetId,kind:el.dataset.kind}));
        ev.dataTransfer.effectAllowed='copy';
      });
      el.ondblclick = () => {
        const asset = (state.project.assets[el.dataset.kind]||[]).find(a=>a.id===el.dataset.assetId);
        if (el.dataset.kind === 'images' && asset) addImageAtPlayhead(asset,trackKind(state.selectedTrack)==='image'?state.selectedTrack:'video');
        if (el.dataset.kind === 'videos' && asset) addVideoAtPlayhead(asset,trackKind(state.selectedTrack)==='image'?state.selectedTrack:'video');
        if (el.dataset.kind === 'music' && asset) addMusicAsset(asset,trackKind(state.selectedTrack)==='audio'?state.selectedTrack:'music',state.playhead);
        if (el.dataset.kind === 'intro' && asset){const clip=introClip();if(clip){selectClip('video',clip.id);seekTo(0);}}
      };
      el.ondragover=ev=>{if(el.dataset.kind==='images'||el.dataset.kind==='audio')ev.preventDefault();};
      el.ondrop=ev=>{if(ev.dataTransfer?.files?.length){ev.preventDefault();ev.stopPropagation();handleFiles(ev.dataTransfer.files);return;}ev.preventDefault();ev.stopPropagation();let data;try{data=JSON.parse(ev.dataTransfer.getData('application/json'));}catch{return;}if(data.kind==='images'&&el.dataset.kind==='images')reorderImages(data.assetId,el.dataset.assetId);else if(data.kind==='audio'&&el.dataset.kind==='audio')reorderNarration(data.assetId,el.dataset.assetId);};
      const deleteButton=el.querySelector('.asset-delete');
      if(deleteButton)deleteButton.onclick=ev=>{ev.stopPropagation();deleteUploadedAsset(el.dataset.kind,el.dataset.assetId);};
      const organizeButton=el.querySelector('.asset-organize');
      if(organizeButton)organizeButton.onclick=ev=>{ev.stopPropagation();showAssetOrganizer(el.dataset.kind,el.dataset.assetId);};
      const previewButton=el.querySelector('.asset-preview');
      if(previewButton)previewButton.onclick=ev=>{ev.stopPropagation();const asset=(state.project.assets[el.dataset.kind]||[]).find(item=>item.id===el.dataset.assetId);if(!asset)return;if(el.dataset.kind==='videos')showVideoPreview(asset);else showImagePreview(asset);};
      const voicePreviewButton=el.querySelector('.voice-preview');
      if(voicePreviewButton){voicePreviewButton.onpointerdown=ev=>ev.stopPropagation();voicePreviewButton.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const asset=state.project.assets.audio.find(item=>item.id===el.dataset.assetId);if(asset)toggleVoicePreview(asset);};}
    });
    updateVoicePreviewButtons();
  }

  function showAssetOrganizer(kind,id){const asset=(state.project.assets[kind]||[]).find(item=>item.id===id);if(!asset)return;state.organizerAsset={kind,id};$('assetOrganizerName').textContent=asset.name;$('assetFolder').value=asset.metadata?.folder||'';$('assetTags').value=(asset.metadata?.tags||[]).join(', ');$('assetColor').value=asset.metadata?.color||'#5b8def';bootstrap.Modal.getOrCreateInstance($('assetOrganizerModal')).show();}
  function saveAssetOrganizer(){const ref=state.organizerAsset,asset=ref&&(state.project.assets[ref.kind]||[]).find(item=>item.id===ref.id);if(!asset)return;asset.metadata||={};asset.metadata.folder=$('assetFolder').value.trim();asset.metadata.tags=$('assetTags').value.split(',').map(value=>value.trim()).filter(Boolean);asset.metadata.color=$('assetColor').value;markDirty(true,'Organize asset');renderAssets();bootstrap.Modal.getOrCreateInstance($('assetOrganizerModal')).hide();}
  function duplicateAsset(){const ref=state.organizerAsset,source=ref&&(state.project.assets[ref.kind]||[]).find(item=>item.id===ref.id);if(!source)return;const copy=deepClone(source);copy.id=uid('asset');copy.name=`${source.name} copy`;state.project.assets[ref.kind].push(copy);if(ref.kind==='audio')state.project.ui.narration_sequence_ids.push(copy.id);markDirty(true,'Duplicate asset');renderAssets();bootstrap.Modal.getOrCreateInstance($('assetOrganizerModal')).hide();toast('Aset diduplikat. File media dipakai bersama.');}

  function visualAnalysisText(metadata={}){
    const caption=String(metadata.ai_caption||'').trim();
    if(metadata.ai_caption_status==='failed'||metadata.ai_caption_error){
      return `${caption?caption+'\n\nHasil sebelumnya. ':''}Analisis terakhir gagal: ${metadata.ai_caption_error||'Model pemahaman visual belum siap.'}\nTekan Analisis ulang untuk mencoba kembali.`;
    }
    const subject=metadata.visual_subject?.label;
    return [caption||'Belum dianalisis. Tekan Analisis ulang atau Analyze & Auto Sync.',subject?`Identifikasi subjek: ${subject}`:''].filter(Boolean).join('\n\n');
  }
  function showImagePreview(asset){
    state.previewAssetId=asset.id;$('imagePreviewTitle').textContent=asset.name;$('imagePreviewLarge').src=asset.source;$('imagePreviewLarge').alt=asset.name;
    $('imageUserDescription').value=asset.metadata?.user_description||'';$('imageSyncCues').value=(asset.metadata?.sync_cues||[]).join(', ');$('imageAiCaption').value=visualAnalysisText(asset.metadata);
    renderVisualVoiceGroup('imageVoiceGroup',asset.metadata?.voice_group);
    $('imageCoverageRequired').checked=asset.metadata?.coverage_required!==false;
    bootstrap.Modal.getOrCreateInstance($('imagePreviewModal')).show();
  }

  async function saveImageMetadata(){
    if(!state.project||!state.previewAssetId)return;
    const syncCues=$('imageSyncCues').value.split(/[,\n]/).map(value=>value.trim()).filter(Boolean);
    const button=$('saveImageMetadataBtn');button.disabled=true;
    try{state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/assets/images/${state.previewAssetId}/visual-metadata`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_description:$('imageUserDescription').value.trim(),sync_cues:syncCues,voice_group:$('imageVoiceGroup').value,coverage_required:$('imageCoverageRequired').checked})}));renderAll();toast('Pemahaman image disimpan. Auto Sync akan memprioritaskannya.');}
    catch(error){toast(error.message,5000);}finally{button.disabled=false;}
  }

  async function reanalyzeImage(){
    if(!state.project||!state.previewAssetId)return;
    const button=$('reanalyzeImageBtn');button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm"></span> Menganalisis…';
    try{state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/assets/images/${state.previewAssetId}/reanalyze`,{method:'POST'}));const asset=state.project.assets.images.find(item=>item.id===state.previewAssetId);if(asset)showImagePreview(asset);renderAll();toast('Analisis image diperbarui.');}
    catch(error){toast(error.message,7000);}finally{button.disabled=false;button.innerHTML='<i class="bi bi-stars"></i> Analisis ulang image';}
  }

  function currentVideoAsset(){return (state.project?.assets?.videos||[]).find(asset=>asset.id===state.previewVideoAssetId);}
  function currentVideoShot(){return (currentVideoAsset()?.metadata?.shots||[]).find(shot=>shot.id===state.selectedVideoShotId);}
  function renderVideoShots(){
    const asset=currentVideoAsset(),shots=asset?.metadata?.shots||[];
    $('videoShotList').innerHTML=shots.map((shot,index)=>`<button type="button" class="video-shot-card ${shot.id===state.selectedVideoShotId?'active':''} ${shot.enabled===false?'disabled':''}" data-shot-id="${escapeHtml(shot.id)}"><img src="${escapeHtml(shot.preview||'')}" alt=""><span><strong>Shot ${index+1}</strong><small>${fmt(Number(shot.source_start)||0)}â€“${fmt(Number(shot.source_end)||0)}</small><small>${escapeHtml(shot.user_description||shot.ai_caption||'Belum dianalisis')}</small></span></button>`).join('')||'<div class="text-secondary small">Belum ada shot. Tekan Analisis ulang video atau buat rentang manual.</div>';
    qsa('.video-shot-card',$('videoShotList')).forEach(button=>button.onclick=()=>selectVideoShot(button.dataset.shotId));
    const shot=currentVideoShot();$('videoShotEditorEmpty').classList.toggle('d-none',!!shot);$('videoShotEditor').classList.toggle('d-none',!shot);
    $('videoShotFrameEvidence').innerHTML=shot?(shot.frame_paths||[]).map((path,index)=>`<figure><img src="${escapeHtml('/media/'+path)}" alt="Frame sampel ${index+1}"><figcaption>${fmt(Number(shot.frame_timestamps?.[index])||0)}</figcaption></figure>`).join(''):'';
    if(shot){$('videoShotEnabled').checked=shot.enabled!==false;$('videoShotDescription').value=shot.user_description||'';$('videoShotCues').value=(shot.sync_cues||[]).join(', ');$('videoShotAiCaption').value=visualAnalysisText(shot);$('videoShotIn').value=Number(shot.source_start||0).toFixed(2);$('videoShotOut').value=Number(shot.source_end||0).toFixed(2);}
  }
  function captureVideoShotEdit(){const shot=currentVideoShot();if(!shot)return;shot.enabled=$('videoShotEnabled').checked;shot.user_description=$('videoShotDescription').value.trim();shot.sync_cues=$('videoShotCues').value.split(/[,\n]/).map(value=>value.trim()).filter(Boolean);shot.source_start=Math.max(0,Number($('videoShotIn').value)||0);shot.source_end=Math.min(Number(currentVideoAsset()?.duration)||Infinity,Number($('videoShotOut').value)||0);shot.duration=Math.max(0,shot.source_end-shot.source_start);}
  function selectVideoShot(id){captureVideoShotEdit();state.selectedVideoShotId=id;const shot=currentVideoShot(),video=$('videoPreviewLarge');if(shot){video.currentTime=Number(shot.source_start)||0;video.play().catch(()=>{});}renderVideoShots();}
  function renderVisualVoiceGroup(elementId,selected){const choices=(state.project?.ui?.narration_sequence_ids||[]).map(id=>(state.project.assets.audio||[]).find(asset=>asset.id===id)).filter(Boolean);const current=selected||'all';$(elementId).innerHTML='<option value="all">Semua voice</option>'+choices.map((asset,index)=>`<option value="${escapeHtml(asset.id)}">Voice ${index+1} · ${escapeHtml(asset.name||asset.id)}</option>`).join('');if(current!=='all'&&!choices.some(asset=>asset.id===current))$(elementId).innerHTML+=`<option value="${escapeHtml(current)}">Voice tidak tersedia (${escapeHtml(current)})</option>`;$(elementId).value=current;}
  function showVideoPreview(asset,preferredShotId=null){state.previewVideoAssetId=asset.id;state.selectedVideoShotId=(asset.metadata?.shots||[]).some(shot=>shot.id===preferredShotId)?preferredShotId:asset.metadata?.shots?.[0]?.id||null;$('videoPreviewTitle').textContent=asset.name;$('videoPreviewLarge').src=asset.source;$('videoUserDescription').value=asset.metadata?.user_description||'';$('videoSyncCues').value=(asset.metadata?.sync_cues||[]).join(', ');renderVisualVoiceGroup('videoVoiceGroup',asset.metadata?.voice_group);$('videoCoverageRequired').checked=asset.metadata?.coverage_required===true;$('videoShotIn').value='0.00';$('videoShotOut').value=Number(asset.duration||0).toFixed(2);renderVideoShots();bootstrap.Modal.getOrCreateInstance($('videoPreviewModal')).show();}
  function addManualVideoShot(){captureVideoShotEdit();const asset=currentVideoAsset(),start=Math.max(0,Number($('videoShotIn').value)||0),end=Math.min(Number(asset?.duration)||0,Number($('videoShotOut').value)||0);if(!asset||end-start<.25){toast('Rentang shot minimal 0,25 detik.',4000);return;}asset.metadata||={};asset.metadata.shots||=[];const id=`${asset.id}-manual-${Date.now().toString(36)}`;asset.metadata.shots.push({id,source_start:start,source_end:end,duration:end-start,enabled:true,user_description:'',sync_cues:[],ai_caption:'',analysis_origin:'manual',preview:''});state.selectedVideoShotId=id;renderVideoShots();}
  function deleteVideoShot(){const asset=currentVideoAsset();if(!asset||!state.selectedVideoShotId)return;asset.metadata.shots=(asset.metadata.shots||[]).filter(shot=>shot.id!==state.selectedVideoShotId);state.selectedVideoShotId=asset.metadata.shots[0]?.id||null;renderVideoShots();}
  async function useSelectedVideoShot(){captureVideoShotEdit();if(!await saveVideoMetadata())return;const asset=currentVideoAsset(),shot=currentVideoShot();if(!asset||!shot||Number(shot.source_end)<=Number(shot.source_start)){toast('Pilih rentang shot yang valid.',4000);return;}const shotDuration=Number(shot.source_end)-Number(shot.source_start),track=trackKind(state.selectedTrack)==='image'?state.selectedTrack:'video',clips=state.project.timeline.tracks[track]||[],active=clips.find(clip=>!isIntroClip(clip)&&state.playhead>=clip.start&&state.playhead<clip.end);if(active){state.selectedTrack=track;state.selected=active.id;state.selectedClips=[selectedKey(track,active.id)];replaceClipVisual(active,asset,'video');}else{addVisualAssetAtPlayhead({...asset,duration:shotDuration},'video',track);}const clip=getSelectedClip();if(!clip||clip.type!=='video')return;clip.metadata.source_offset=round3(Number(shot.source_start));clip.metadata.source_end=round3(Number(shot.source_end));clip.metadata.source_duration=round3(shotDuration);clip.metadata.shot_id=shot.id;clip.metadata.visual_candidate_id=shot.id;clip.metadata.shot_preview=shot.preview||'';clip.manual_override=true;markDirty(true,'Use B-roll shot');renderAll();bootstrap.Modal.getOrCreateInstance($('videoPreviewModal')).hide();toast('Shot B-roll dipasang di timeline.');}
  async function saveVideoMetadata(){const asset=currentVideoAsset();if(!asset)return false;captureVideoShotEdit();const selectedShotId=state.selectedVideoShotId,button=$('saveVideoMetadataBtn');button.disabled=true;try{state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/assets/videos/${asset.id}/visual-metadata`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_description:$('videoUserDescription').value.trim(),sync_cues:$('videoSyncCues').value.split(/[,\n]/).map(value=>value.trim()).filter(Boolean),voice_group:$('videoVoiceGroup').value,coverage_required:$('videoCoverageRequired').checked,shots:(asset.metadata?.shots||[]).map(shot=>({id:shot.id,source_start:shot.source_start,source_end:shot.source_end,enabled:shot.enabled!==false,user_description:shot.user_description||'',sync_cues:shot.sync_cues||[]}))})}));const updated=state.project.assets.videos.find(item=>item.id===asset.id);if(updated)showVideoPreview(updated,selectedShotId);renderAll();toast('Video dan shot disimpan.');return true;}catch(error){toast(error.message,6000);return false;}finally{button.disabled=false;}}
  async function reanalyzeVideo(){const asset=currentVideoAsset();if(!asset)return;captureVideoShotEdit();if(!await saveVideoMetadata())return;const button=$('reanalyzeVideoBtn');button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm"></span> Menganalisisâ€¦';try{state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/assets/videos/${asset.id}/reanalyze`,{method:'POST'}));const updated=state.project.assets.videos.find(item=>item.id===asset.id);if(updated)showVideoPreview(updated);renderAll();toast('Shot video dan pemahaman AI diperbarui.');}catch(error){toast(error.message,8000);}finally{button.disabled=false;button.innerHTML='<i class="bi bi-stars"></i> Analisis ulang video';}}

  function confidencePercent(c){
    const stored=Number(c?.metadata?.confidence_percent);
    return Number.isFinite(stored)?Math.max(0,Math.min(100,Math.round(stored))):Math.round(Math.max(0,Math.min(1,Number(c?.semantic_score)||0))*100);
  }
  function confidenceText(c){return `${c?.confidence||'LOW'} CONFIDENCE`;}

  function renderScenes() {
    const clips = state.project.timeline.tracks.video || [];
    $('sceneList').innerHTML = clips.map((c,i) => `
      <div class="scene-item ${state.selected===c.id&&state.selectedTrack==='video'?'active':''}" data-clip-id="${c.id}">
        ${c.type==='video'?'<div class="scene-video-thumb"><i class="bi bi-film"></i></div>':`<img src="${c.source}" alt="">`}<div><strong class="small">${isIntroClip(c)?'Intro Video':c.type==='video'?`B-roll Video ${i+1}`:`Scene ${i+1}${c.metadata?.image_order?` · Image ${c.metadata.image_order}`:''}${c.metadata?.virtual_shot_label?` · ${escapeHtml(c.metadata.virtual_shot_label)}`:''}`}</strong><div class="meta scene-confidence ${(c.confidence||'LOW').toLowerCase()}">${fmt(c.start)}–${fmt(c.end)}${isIntroClip(c)?' · Visual pembuka':c.type==='video'?` · Audio sumber ${c.metadata?.source_audio_enabled?'aktif':'dibisukan'} · AI ${confidencePercent(c)}%`:` · AI ${confidencePercent(c)}% · ${confidenceText(c)}`}</div></div>
      </div>`).join('');
    qsa('.scene-item').forEach(el => el.onclick = () => selectClip('video', el.dataset.clipId));
  }

  function calcTimelineWidth() {
    const dur = Math.max(10, state.project.timeline.duration || 0);
    return Math.max(1000, dur * state.pixelsPerSecond + 100);
  }

  function renderRuler() {
    const ruler = $('ruler'); const duration = Math.max(10, state.project.timeline.duration || 0);
    const px = state.pixelsPerSecond;
    let step = 1;
    if (px < 10) step=10; else if (px < 20) step=5; else if (px < 45) step=2; else step=1;
    let html='';
    for (let t=0;t<=duration+step;t+=step) html += `<div class="tick" style="left:${t*px}px">${fmt(t).slice(0,5)}</div>`;
    const loop=state.project.ui.loop_range||{};if(loop.enabled&&loop.out>loop.in)html+=`<div class="loop-range" style="left:${loop.in*px}px;width:${(loop.out-loop.in)*px}px" title="Loop ${fmt(loop.in)} - ${fmt(loop.out)}"></div>`;
    html+=(state.project.ui.markers||[]).map((time,index)=>`<button class="timeline-marker" style="left:${time*px}px" data-marker-index="${index}" title="Marker ${index+1}: ${fmt(time)}. Klik untuk menuju, klik kanan untuk hapus." aria-label="Marker ${index+1}"><i class="bi bi-bookmark-fill"></i></button>`).join('');
    ruler.innerHTML = html;
    qsa('.timeline-marker',ruler).forEach(marker=>{marker.onclick=event=>{event.stopPropagation();seekTo(state.project.ui.markers[Number(marker.dataset.markerIndex)]);};marker.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();state.project.ui.markers.splice(Number(marker.dataset.markerIndex),1);markDirty(true,'Delete marker');renderRuler();};});
  }

  function renderTimeline() {
    if (!state.project) return;
    const width = calcTimelineWidth();
    $('timelineContent').style.width = `${width}px`; renderRuler();
    qsa('.track',$('timelineContent')).forEach(track=>track.remove());
    $('trackLabels').innerHTML='<div class="ruler-label"><strong>TRACK</strong><span title="V = Visual/Gambar · A = Audio · T = Text Overlay · S = Caption">V Visual · A Audio · T Text · S Caption</span></div>';
    for(const track of trackDefinitions()){
      const visible=visibleTrack(track.id),clips=state.project.timeline.tracks[track.id]||[];
      const volume=clamp(state.project.ui.track_volume[track.id]??clips[0]?.volume??(track.id==='music'?.1:1),0,1);
      const audioControls=['audio','narration'].includes(track.kind)?`<label class="track-volume-control" title="Atur volume ${escapeHtml(track.label)}"><span>Vol</span><input class="track-volume" data-volume-track="${track.id}" type="range" min="0" max="1" step="0.01" value="${volume}" title="Volume ${Math.round(volume*100)}%" aria-label="Volume ${escapeHtml(track.label)}"></label><button class="track-solo ${state.project.ui.track_solo[track.id]?'is-active':''}" data-solo-track="${track.id}" title="Solo: dengarkan hanya ${escapeHtml(track.label)}" aria-label="Solo ${escapeHtml(track.label)}"><i class="bi bi-headphones"></i></button>`:'';
      const deleteControl=DEFAULT_TRACKS.some(item=>item.id===track.id)?'':`<button class="track-delete" data-delete-track="${track.id}" title="Hapus ${escapeHtml(track.label)}" aria-label="Hapus ${escapeHtml(track.label)}"><i class="bi bi-trash3"></i></button>`;
      $('trackLabels').insertAdjacentHTML('beforeend',`<div class="track-label-row ${state.selectedTrack===track.id?'is-active':''}" data-label-track="${track.id}" title="${escapeHtml(track.code)} — ${escapeHtml(track.label)}"><div class="track-label-copy"><strong>${escapeHtml(track.code)}</strong><small>${escapeHtml(track.label)}</small></div>${audioControls}<button class="track-eye ${visible?'':'is-hidden'}" data-visibility-track="${track.id}" title="${visible?'Sembunyikan':'Tampilkan'} ${escapeHtml(track.label)}" aria-label="${visible?'Sembunyikan':'Tampilkan'} ${escapeHtml(track.label)}"><i class="bi ${visible?'bi-eye':'bi-eye-slash'}"></i></button>${deleteControl}</div>`);
      const lane=document.createElement('div');lane.id=`track-${track.id}`;lane.className=`track ${track.kind==='audio'?'track-music':track.kind==='text'?'track-subtitle':track.kind==='narration'?'track-audio':'track-video'} ${visible?'':'is-hidden'} ${state.selectedTrack===track.id?'is-active':''}`;lane.dataset.track=track.id;
      if(track.kind==='narration')lane.innerHTML='<div id="waveform"></div>';
      $('timelineContent').insertBefore(lane,$('playhead'));
      renderTrack(track.id,lane);
    }
    bindTrackControls();
    qsa('.track',$('timelineContent')).forEach(el=>{const track=el.dataset.track;el.ondragover=e=>e.preventDefault();el.ondrop=e=>handleTrackDrop(e,track);el.onclick=e=>{if(e.target===el){const rect=el.getBoundingClientRect();state.selectedTrack=track;seekTo((e.clientX-rect.left)/state.pixelsPerSecond);state.selected=null;state.selectedClips=[];renderTimeline();renderInspector();}};el.ondblclick=e=>{if(track!=='subtitle'&&trackKind(track)==='text'&&e.target===el){const rect=el.getBoundingClientRect();state.playhead=Math.max(0,(e.clientX-rect.left)/state.pixelsPerSecond);addTextAtPlayhead(track);}};});
    $('playhead').style.left = `${state.playhead * state.pixelsPerSecond}px`;
    setupTimelineInteractions(); updateZoomLabel();requestAnimationFrame(initWaveform);
  }

  function clipClass(track,c) { const kind=trackKind(track);return isIntroClip(c)?'clip-intro':kind==='audio'?'clip-music':kind==='text'?'clip-subtitle':kind==='narration'?'clip-audio':''; }
  function renderTrack(track, el) {
    const clips = state.project.timeline.tracks[track] || [];
    if(trackKind(track)==='narration')qsa('.clip',el).forEach(clip=>clip.remove());else el.innerHTML='';
    el.insertAdjacentHTML('beforeend',clips.map(c => clipHtml(track,c)).join(''));
    if(trackKind(track)==='image') el.insertAdjacentHTML('beforeend', clips.filter(c=>(c.transition_out||'none')!=='none').map(c=>`<div class="transition-marker" data-transition-for="${c.id}" style="left:${c.end*state.pixelsPerSecond}px" title="${escapeHtml(c.transition_out||'crossfade')}"></div>`).join(''));
    attachClipEvents(el, track);
    if(trackKind(track)==='image') qsa('.transition-marker',el).forEach(m=>m.onclick=e=>{e.stopPropagation();selectClip(track,m.dataset.transitionFor);});
  }

  function clipHtml(track,c) {
    const left = c.start * state.pixelsPerSecond, width = Math.max(6, clipDuration(c)*state.pixelsPerSecond);
    const selected = isSelected(track,c.id),kind=trackKind(track);
    const virtualLabel=track==='video'&&c.metadata?.virtual_shot_label?` · ${c.metadata.virtual_shot_label}`:'';
    const title = kind==='text' ? (c.text||'Text') : `${fileName(c.source)}${virtualLabel}`;
    const dragHint=kind==='image'?'Geser horizontal untuk waktu; vertikal untuk pindah track Visual':kind==='text'&&track!=='subtitle'?'Geser horizontal untuk waktu; vertikal untuk pindah track Text':'Geser horizontal untuk mengubah waktu';
    const thumbs = kind==='image' ? c.type==='video'?'<div class="thumb-strip intro-strip"><i class="bi bi-film"></i></div>':`<div class="thumb-strip">${Array.from({length:Math.min(7,Math.max(1,Math.ceil(width/72)))},()=>`<img src="${c.source}">`).join('')}</div>` : ['audio','narration'].includes(kind)?'<div class="clip-waveform" aria-hidden="true"></div>':'';
    const conf = track==='video'&&c.type==='image' ? `<div class="confidence ${(c.confidence||'LOW').toLowerCase()}" title="AI confidence ${confidencePercent(c)}% · ${confidenceText(c)}">${c.confidence==='LOW'?'⚠ ':''}${confidencePercent(c)}% · ${confidenceText(c)}</div>` : '';
    return `<div class="clip ${clipClass(track,c)} ${selected?'selected':''} ${c.locked?'locked':''}" data-track="${track}" data-id="${c.id}" style="left:${left}px;width:${width}px" title="${dragHint}">
      ${thumbs}<div class="clip-title">${escapeHtml(title)}</div>${conf}
      ${c.locked?'':`<div class="resize-handle left"></div><div class="resize-handle right"></div>`}
    </div>`;
  }

  function renderNarrationTrack() {
    const el = $('track-narration');if(el)renderTrack('narration',el);
  }

  function bindTrackControls(){
    qsa('[data-label-track]').forEach(row=>row.onclick=event=>{if(event.target.closest('button,input,label'))return;state.selectedTrack=row.dataset.labelTrack;state.selected=null;state.selectedClips=[];renderTimeline();renderInspector();});
    qsa('[data-visibility-track]').forEach(button=>button.onclick=()=>{const id=button.dataset.visibilityTrack;state.project.ui.track_visibility[id]=!visibleTrack(id);markDirty(true,`${visibleTrack(id)?'Show':'Hide'} track`);renderAll();});
    qsa('[data-solo-track]').forEach(button=>button.onclick=()=>{const id=button.dataset.soloTrack;state.project.ui.track_solo[id]=!state.project.ui.track_solo[id];markDirty(true,`${state.project.ui.track_solo[id]?'Solo':'Unsolo'} track`);renderAll();});
    qsa('[data-volume-track]').forEach(input=>{input.oninput=()=>{const id=input.dataset.volumeTrack,value=clamp(input.value,0,1);state.project.ui.track_volume[id]=value;input.title=`Volume ${Math.round(value*100)}%`;for(const clip of state.project.timeline.tracks[id]||[])clip.volume=value;applyPreviewAudioLevels();markDirty(false);};input.onchange=()=>markDirty(true,'Track volume');});
    qsa('[data-delete-track]').forEach(button=>button.onclick=()=>deleteTrack(button.dataset.deleteTrack));
  }

  function fileName(src='') { try { return decodeURIComponent(src.split('/').pop()); } catch { return src; } }

  function attachClipEvents(el, track) {
    qsa('.clip', el).forEach(cel => {
      cel.onclick = ev => { ev.stopPropagation(); selectClip(track,cel.dataset.id,ev.shiftKey||ev.ctrlKey||ev.metaKey); };
      cel.oncontextmenu = ev => { ev.preventDefault(); selectClip(track,cel.dataset.id); showContextMenu(ev.clientX,ev.clientY); };
      cel.ondragover = ev => { ev.preventDefault(); };
      cel.ondrop = ev => { ev.preventDefault(); handleAssetDropOnClip(ev, track, cel.dataset.id); };
    });
  }

  function setupTimelineInteractions() {
    if (!window.interact) return;
    window.interact('.clip:not([data-track="narration"])')
      .draggable({
        listeners:{
          move(ev){
            const el=ev.target,track=el.dataset.track,c=findClip(track,el.dataset.id);if(!c||c.locked||isIntroClip(c))return;
            const dx=(parseFloat(el.dataset.dx)||0)+ev.dx,vertical=['image','text'].includes(trackKind(track))&&track!=='subtitle',dy=vertical?(parseFloat(el.dataset.dy)||0)+ev.dy:0;el.dataset.dx=dx;el.dataset.dy=dy;el.dataset.clientY=String(ev.clientY??ev.client?.y??'');el.style.transform=`translate(${dx}px,${dy}px)`;
          },
          end(ev){
            const el=ev.target, track=el.dataset.track, c=findClip(track,el.dataset.id); if(!c||c.locked||isIntroClip(c))return;
            const dx=parseFloat(el.dataset.dx)||0,clientY=Number(el.dataset.clientY);el.dataset.dx='0';el.dataset.dy='0';delete el.dataset.clientY;el.style.transform='';
            let start=Math.max(0,c.start + dx/state.pixelsPerSecond); start=snapTime(start,c.id);
            const selected=selectedEntries().filter(entry=>entry.track===track),group=selected.some(entry=>entry.id===c.id)&&selected.length>1;
            let destination=compatibleTrackAtY(track,clientY);if(group&&destination!==track){destination=track;toast('Pindah antar track hanya untuk satu clip.');}
            if(group){moveSelectedGroup(track,start-c.start);}else{const d=clipDuration(c);let end=start+d;if(destination!==track&&trackKind(track)==='image'&&(state.project.timeline.tracks[destination]||[]).some(item=>item.start<end&&item.end>start)){toast('Track tujuan sudah berisi image pada waktu tersebut.');destination=track;}if(destination===track&&trackKind(track)==='image'){const timing=safeVisualTiming(c,start,end,track);start=timing.start;end=timing.end;if(timing.adjusted)toast('Posisi dibatasi agar scene tidak overlap.');}if(destination!==track){state.project.timeline.tracks[track]=state.project.timeline.tracks[track].filter(item=>item.id!==c.id);state.project.timeline.tracks[destination].push(c);state.project.timeline.tracks[destination].sort((a,b)=>a.start-b.start);state.selectedTrack=destination;state.selectedClips=state.selectedClips.map(key=>key===selectedKey(track,c.id)?selectedKey(destination,c.id):key);}c.start=round3(start);c.end=round3(end);c.duration=round3(end-start);c.manual_override=true;c.metadata||={};c.metadata.manual_revision=Date.now();}
            extendDuration(); markDirty(true,destination===track?'Move clip':'Move clip between tracks'); renderAll();
          }
        }
      })
      .resizable({
        edges:{left:'.resize-handle.left',right:'.resize-handle.right'},
        listeners:{
          move(ev){
            const el=ev.target,c=findClip(el.dataset.track,el.dataset.id); if(!c||c.locked)return;
            el.style.width=`${ev.rect.width}px`;
            if(ev.deltaRect.left){ const tx=(parseFloat(el.dataset.rtx)||0)+ev.deltaRect.left; el.dataset.rtx=tx; el.style.transform=`translateX(${tx}px)`; }
          },
          end(ev){
            const el=ev.target,track=el.dataset.track,c=findClip(track,el.dataset.id); if(!c||c.locked)return;
            const leftShift=(parseFloat(el.dataset.rtx)||0)/state.pixelsPerSecond; el.dataset.rtx='0'; el.style.transform='';
            let newStart=c.start+leftShift; let newDur=ev.rect.width/state.pixelsPerSecond;
            if(Math.abs(leftShift)>0.0001){ newStart=snapTime(Math.max(0,newStart),c.id); c.start=round3(newStart); }
            let newEnd=snapTime(c.start+Math.max(.1,newDur),c.id);
            if(trackKind(track)==='image'){const timing=safeVisualTiming(c,newStart,newEnd,track);c.start=timing.start;c.end=timing.end;if(timing.adjusted)toast('Ukuran dibatasi agar scene tidak overlap.');}else{c.end=round3(Math.max(c.start+.1,newEnd));}c.duration=round3(c.end-c.start);c.manual_override=true;c.metadata||={};c.metadata.manual_revision=Date.now();
            extendDuration(); markDirty(true,'Resize clip'); renderAll();
          }
        }
      });
  }

  function findClip(track,id) { return (state.project.timeline.tracks[track]||[]).find(c=>c.id===id); }
  function compatibleTrackAtY(source,y){const kind=trackKind(source);if(!Number.isFinite(y)||!['image','text'].includes(kind)||source==='subtitle')return source;const lane=qsa('.track',$('timelineContent')).find(item=>{const id=item.dataset.track,rect=item.getBoundingClientRect();return y>=rect.top&&y<=rect.bottom&&trackKind(id)===kind&&(kind!=='text'||id!=='subtitle');});return lane?.dataset.track||source;}
  function moveSelectedGroup(track,delta){
    const ids=new Set(selectedEntries().filter(entry=>entry.track===track).map(entry=>entry.id));
    const moving=(state.project.timeline.tracks[track]||[]).filter(clip=>ids.has(clip.id)&&!clip.locked);
    if(!moving.length)return;
    let safeDelta=Math.max(delta,-Math.min(...moving.map(clip=>clip.start)));
    if(trackKind(track)==='image'){
      const others=(state.project.timeline.tracks[track]||[]).filter(clip=>!ids.has(clip.id));
      const first=Math.min(...moving.map(clip=>clip.start)),last=Math.max(...moving.map(clip=>clip.end));
      const previous=[...others].filter(clip=>clip.end<=first+.001).sort((a,b)=>b.end-a.end)[0];
      const next=others.filter(clip=>clip.start>=last-.001).sort((a,b)=>a.start-b.start)[0];
      safeDelta=Math.max(previous?previous.end-first:-first,Math.min(safeDelta,next?next.start-last:Infinity));
    }
    for(const clip of moving){clip.start=round3(clip.start+safeDelta);clip.end=round3(clip.end+safeDelta);clip.manual_override=true;clip.metadata||={};clip.metadata.manual_revision=Date.now();}
  }
  function round3(n){ return Math.round(n*1000)/1000; }
  function extendDuration(){
    const all = Object.values(state.project.timeline.tracks).flat();
    state.project.timeline.duration = Math.max(state.project.timeline.duration||0, ...all.map(c=>Number(c.end)||0), 0);
  }

  function snapTime(t, excludeId=null) {
    if (!$('snapToggle').checked) return t;
    const threshold = 8/state.pixelsPerSecond;
    const points=[state.playhead];
    for(const clips of Object.values(state.project.timeline.tracks))for(const c of clips||[])if(c.id!==excludeId)points.push(c.start,c.end);
    let best=t, dist=threshold;
    for(const p of points){ const d=Math.abs(t-p); if(d<dist){dist=d;best=p;} }
    return best;
  }

  function visualTimingBounds(c,track=state.selectedTrack){
    if(!c||isIntroClip(c))return {min:0,max:clipDuration(c)};
    const clips=(state.project.timeline.tracks[track]||[]).filter(item=>item.id!==c.id).sort((a,b)=>a.start-b.start);
    const previous=[...clips].reverse().find(item=>item.end<=c.start+.001);
    const next=clips.find(item=>item.start>=c.end-.001);
    return {min:previous?Number(previous.end):0,max:next?Number(next.start):Infinity};
  }

  function safeVisualTiming(c,start,end,track=state.selectedTrack){
    if(!c||isIntroClip(c))return {start:c?.start||0,end:c?.end||0,adjusted:false};
    const bounds=visualTimingBounds(c,track),minimum=.1;
    const safeStart=Math.max(bounds.min,Math.min(start,Number.isFinite(bounds.max)?bounds.max-minimum:start));
    const safeEnd=Math.max(safeStart+minimum,Math.min(end,bounds.max));
    return {start:round3(safeStart),end:round3(safeEnd),adjusted:Math.abs(safeStart-start)>.001||Math.abs(safeEnd-end)>.001};
  }

  function selectClip(track,id,multi=false) {
    const key=selectedKey(track,id);
    if(multi){state.selectedClips=state.selectedClips.includes(key)?state.selectedClips.filter(item=>item!==key):[...state.selectedClips,key];}
    else state.selectedClips=[key];
    const primary=state.selectedClips[state.selectedClips.length-1];
    if(primary){const cut=primary.indexOf(':');state.selectedTrack=primary.slice(0,cut);state.selected=primary.slice(cut+1);}else{state.selectedTrack=track;state.selected=null;}
    renderTimeline(); renderScenes(); renderInspector(); updatePreview(state.playhead);
  }

  function renderInspector() {
    const c=getSelectedClip(); $('inspectorEmpty').classList.toggle('d-none',!!c); $('inspector').classList.toggle('d-none',!c); if(!c)return;
    const kind=trackKind(state.selectedTrack),intro=isIntroClip(c),visual=kind==='image',imageVisual=visual&&c.type==='image',videoVisual=visual&&c.type==='video'&&!intro;
    $('insFilename').textContent = c.type==='subtitle'?'Subtitle':`${fileName(c.source)}${c.metadata?.virtual_shot_label?` · ${c.metadata.virtual_shot_label}`:''}`;
    $('manualEditStatus').className=`manual-edit-status ${intro?'intro':c.manual_override?'protected':''}`;$('manualEditStatus').innerHTML=intro?'<i class="bi bi-film"></i> Intro terkunci di awal dan tidak diubah Auto Sync.':c.manual_override?'<i class="bi bi-shield-check"></i> Edit manual dilindungi saat Auto Sync diulang.':'<i class="bi bi-stars"></i> Scene masih mengikuti hasil Auto Sync.';
    $('visualSourceWrap').classList.toggle('d-none',!visual);
    if(visual){const assets=intro?(state.project.assets.intro||[]):[...(state.project.assets.images||[]),...(state.project.assets.videos||[])];$('insVisualSource').innerHTML=assets.map(asset=>`<option value="${asset.id}">${asset.kind==='videos'?'Video · ':''}${escapeHtml(asset.name)}</option>`).join('');$('insVisualSource').value=c.metadata?.asset_id||'';$('insVisualSource').disabled=intro;}
    $('insStart').value=c.start; $('insEnd').value=c.end; $('insDuration').value=clipDuration(c).toFixed(3);
    for(const id of ['insStart','insEnd','insDuration','setStartBtn','setEndBtn'])$(id).disabled=intro;
    $('manualTimingHint').textContent=intro?'Durasi mengikuti file video. Hapus atau upload intro baru untuk menggantinya.':'Timing otomatis dibatasi agar scene tidak overlap.';
    $('insScore').textContent = state.selectedTrack==='video' ? `${confidencePercent(c)}%`:'—';
    const matchLabel=['clip_visual','siglip2_visual'].includes(c.metadata?.match_method)?'4-signal Visual AI':c.metadata?.match_method==='filename_fallback'?'4-signal fallback':'';
    $('insConfidence').textContent=`${state.selectedTrack==='video'?confidenceText(c):'—'}${matchLabel?` · ${matchLabel}`:''}`;
    const scoreParts=state.selectedTrack==='video'?(c.metadata?.score_components||{}):{};
    const showPart=value=>Number.isFinite(Number(value))?`${Math.round(Number(value)*100)}%`:'—';
    $('insVisualScore').textContent=showPart(scoreParts.direct_visual);
    $('insCaptionScore').textContent=showPart(scoreParts.caption);
    $('insKeywordScore').textContent=showPart(scoreParts.keyword);
    $('insTimelineScore').textContent=showPart(scoreParts.timeline);
    $('insFinalScore').textContent=showPart(scoreParts.final);
    $('insCaptionModel').textContent=c.metadata?.caption_method?.startsWith('florence2_multilingual')?'Florence-2 + multilingual semantic':c.metadata?.caption_method==='florence2_bge_m3'?'Florence-2 + BGE-M3':c.metadata?.caption_method?.startsWith('florence2_token_fallback')?'Florence-2 + token fallback':state.selectedTrack==='video'?'Fallback':'—';
    $('insImageCaption').textContent=state.selectedTrack==='video'?(c.metadata?.image_caption||'Caption visual belum tersedia.') : '';
    $('insGlobalScore').textContent=c.metadata?.optimizer_components?.total!=null?`${Math.round(c.metadata.optimizer_components.total*100)}%`:'—'; $('insLock').checked=!!c.locked; $('insManual').checked=!!c.manual_override;
    const reasons=state.selectedTrack==='video'?(c.metadata?.selection_reasons||{}):{},signals=c.metadata?.confidence_signals||{},alternative=reasons.closest_alternative;
    $('insReasonCaption').textContent=reasons.caption_match||'Tidak tersedia';
    $('insReasonSummary').textContent=[reasons.media_kind==='video'?'Cuplikan video.':reasons.media_kind==='image'?'Gambar.':'',reasons.summary||'',reasons.subject_match||'',reasons.needs_review?'Kecocokan belum meyakinkan; perlu diperiksa.':''].filter(Boolean).join(' ');
    $('insReasonAction').textContent=reasons.action_match||'Tidak ada frasa aksi dominan';
    $('insReasonAlternative').textContent=alternative?`${alternative.name||'Image lain'} · ${Math.round((alternative.score||0)*100)}%`:'Tidak ada alternatif';
    $('insReasonTimeline').textContent=Number.isFinite(Number(reasons.timeline_influence))?`${Math.round(Number(reasons.timeline_influence)*100)}% pengaruh urutan`:'—';
    $('insReasonAgreement').textContent=Number.isFinite(Number(signals.direct_caption_agreement))?`${Math.round(Number(signals.direct_caption_agreement)*100)}%`:'—';
    const sceneCheck=reasons.scene_verifier||{};
    $('insReasonScene').textContent=sceneCheck.match?`${sceneCheck.match==='supported'?'Didukung':sceneCheck.match==='contradicted'?'Bertentangan':'Belum jelas'} · ${[...(sceneCheck.actions||[]),...(sceneCheck.objects||[]),...(sceneCheck.uncertain||[])].slice(0,3).join('; ')||'bukti terbatas'}`:'Tidak diperiksa';
    $('imageInspector').classList.toggle('d-none',!visual); $('subtitleInspector').classList.toggle('d-none',kind!=='text'); $('audioInspector').classList.toggle('d-none',!['narration','audio'].includes(kind));$('aiInspector').classList.toggle('d-none',!visual||intro);$('suggestionsInspector').classList.toggle('d-none',!visual||intro);$('videoInspectorFields').classList.toggle('d-none',!videoVisual);
    if(visual){
      $('insMotion').value=c.motion||'static'; $('insMotionSpeed').value=c.motion_speed||'slow'; $('insScale').value=c.scale??1; $('insPosX').value=c.position_x??0; $('insPosY').value=c.position_y??0; $('insCropTop').value=c.crop?.top||0; $('insCropRight').value=c.crop?.right||0; $('insCropBottom').value=c.crop?.bottom||0; $('insCropLeft').value=c.crop?.left||0; $('insFit').value=c.fit_mode||'cover'; $('insTransition').value=c.transition_out||'crossfade';
      $('insMotion').disabled=intro;$('insMotionSpeed').disabled=intro;
      if(videoVisual){const asset=(state.project.assets.videos||[]).find(item=>item.id===c.metadata?.asset_id),sourceIn=Math.max(0,Number(c.metadata?.source_offset)||0),sourceOut=Number(c.metadata?.source_end);$('insSourceIn').max=Number(asset?.duration)||'';$('insSourceOut').max=Number(asset?.duration)||'';$('insSourceIn').value=sourceIn.toFixed(3);$('insSourceOut').value=(Number.isFinite(sourceOut)?sourceOut:sourceIn+clipDuration(c)).toFixed(3);$('insSourceAudio').checked=!!c.metadata?.source_audio_enabled;$('insSourceVolume').value=Number(c.volume)||0;$('insSourceVolume').disabled=!$('insSourceAudio').checked;$('insSourceFadeIn').value=Number(c.fade_in)||0;$('insSourceFadeOut').value=Number(c.fade_out)||0;}
    }
    if(kind==='text'){const captionTrack=state.selectedTrack==='subtitle';$('textContentLabel').textContent=captionTrack?'Caption Text':'Text Overlay';$('textStyleLabel').textContent=captionTrack?'Caption Style':'Text Style';$('applyCaptionStyleAll').classList.toggle('d-none',!captionTrack);$('insSubtitleText').value=c.text||'';$('insSubtitleSize').value=c.font_size||42;$('insSubtitlePosition').value=c.subtitle_position||'bottom';$('insTextFont').value=c.font_family||'Arial';$('insTextPosX').value=c.position_x||0;$('insTextPosY').value=c.position_y||0;qsa('.caption-style-card').forEach(card=>card.classList.toggle('active',card.dataset.captionStyle===(c.caption_style||'classic')));}
    if(['narration','audio'].includes(kind)){ $('insVolume').max='1'; $('insVolume').value=clamp(c.volume??(kind==='audio'?.1:1),0,1); $('insFadeIn').value=c.fade_in||0; $('insFadeOut').value=c.fade_out||0; $('duckingWrap').classList.toggle('d-none',kind!=='audio'); $('insDucking').checked=!!state.project.timeline.settings.auto_ducking; }
    $('insLock').disabled=intro;$('insManual').disabled=intro;$('replaceBtn').disabled=intro;$('duplicateBtn').disabled=intro;$('splitBtn').disabled=intro;$('deleteBtn').textContent=intro?'Hapus Intro':'Delete';
    renderSuggestions(c);
  }

  function renderSuggestions(c) {
    const list=c.metadata?.suggestions||[]; $('suggestionList').innerHTML = list.map((s,i)=>`<div class="suggestion-row"><img src="${s.source}"><div><div class="small">Alternative ${i+1}${s.image_order?` · Image ${s.image_order}`:s.kind==='videos'?' · Video shot':''}</div><small>${Number.isFinite(Number(s.match_percent))?Math.round(Number(s.match_percent)):Math.round((s.score||0)*100)}% match · ${escapeHtml(s.name)}</small></div><button class="btn btn-xs btn-outline-info use-suggestion" data-suggestion-index="${i}">Use</button></div>`).join('') || '<div class="text-secondary small">Tidak ada alternatif visual.</div>';
    qsa('.use-suggestion').forEach(button=>button.onclick=()=>useVisualSuggestion(list[Number(button.dataset.suggestionIndex)]));
  }
  function useVisualSuggestion(suggestion){const c=getSelectedClip();if(!c||!suggestion)return;const asset=(state.project.assets[suggestion.kind||'images']||[]).find(item=>item.id===suggestion.asset_id);if(!asset)return;replaceClipVisual(c,asset,suggestion.kind==='videos'?'video':'image');if(suggestion.kind==='videos'){c.metadata.visual_candidate_id=suggestion.visual_candidate_id;c.metadata.shot_id=suggestion.shot_id;c.metadata.source_offset=Number(suggestion.source_offset)||0;c.metadata.source_end=Number(suggestion.source_end)||c.metadata.source_offset+clipDuration(c);c.metadata.source_duration=c.metadata.source_end-c.metadata.source_offset;}markDirty(true,'Use AI visual suggestion');renderAll();}

  function applyInspectorChange(label='Edit clip') {
    const c=getSelectedClip(); if(!c)return;
    if(isIntroClip(c))return;
    const kind=trackKind(state.selectedTrack);
    let start=Math.max(0,Number($('insStart').value)||0), end=Math.max(start+.1,Number($('insEnd').value)||start+.1);
    if(kind==='image'){const timing=safeVisualTiming(c,start,end,state.selectedTrack);start=timing.start;end=timing.end;if(timing.adjusted)toast('Timing disesuaikan agar scene tidak overlap.');}
    c.start=round3(start); c.end=round3(end); c.duration=round3(end-start); c.locked=$('insLock').checked; c.manual_override=true;c.metadata||={};c.metadata.manual_revision=Date.now();
    if(kind==='image'){
      c.motion=$('insMotion').value; c.motion_speed=$('insMotionSpeed').value; c.scale=Number($('insScale').value)||1; c.position_x=Number($('insPosX').value)||0; c.position_y=Number($('insPosY').value)||0; c.crop={top:Number($('insCropTop').value)||0,right:Number($('insCropRight').value)||0,bottom:Number($('insCropBottom').value)||0,left:Number($('insCropLeft').value)||0}; c.fit_mode=$('insFit').value; c.transition_out=$('insTransition').value;
      if(c.type==='video'){const asset=(state.project.assets.videos||[]).find(item=>item.id===c.metadata?.asset_id),limit=Number(asset?.duration)||Infinity,sourceIn=Math.max(0,Math.min(limit,Number($('insSourceIn').value)||0)),sourceOut=Math.max(sourceIn+.01,Math.min(limit,Number($('insSourceOut').value)||sourceIn+clipDuration(c)));c.metadata.source_offset=round3(sourceIn);c.metadata.source_end=round3(sourceOut);c.metadata.source_duration=round3(sourceOut-sourceIn);c.metadata.source_audio_enabled=$('insSourceAudio').checked;c.volume=c.metadata.source_audio_enabled?clamp($('insSourceVolume').value,0,2):0;c.fade_in=Math.max(0,Number($('insSourceFadeIn').value)||0);c.fade_out=Math.max(0,Number($('insSourceFadeOut').value)||0);}
    }
    if(kind==='text'){ c.text=$('insSubtitleText').value; c.font_size=clamp($('insSubtitleSize').value||42,5,120); c.font_family=$('insTextFont').value;c.subtitle_position=$('insSubtitlePosition').value; c.position_x=clamp($('insTextPosX').value,-50,50); c.position_y=clamp($('insTextPosY').value,-50,50); }
    if(['narration','audio'].includes(kind)){ c.volume=clamp($('insVolume').value,0,1); state.project.ui.track_volume[state.selectedTrack]=c.volume; c.fade_in=Math.max(0,Number($('insFadeIn').value)||0); c.fade_out=Math.max(0,Number($('insFadeOut').value)||0); if(kind==='narration') state.project.timeline.settings.narration_volume=c.volume; if(kind==='audio'){ state.project.timeline.settings.music_volume=c.volume; state.project.timeline.settings.auto_ducking=$('insDucking').checked; } }
    extendDuration(); markDirty(true,label); renderAll();
  }

  function previewTextInspectorEdit(){
    const c=getSelectedClip();if(!c||trackKind(state.selectedTrack)!=='text')return;
    c.text=$('insSubtitleText').value;c.font_size=clamp($('insSubtitleSize').value||42,5,120);c.font_family=$('insTextFont').value;c.position_x=clamp($('insTextPosX').value,-50,50);c.position_y=clamp($('insTextPosY').value,-50,50);c.manual_override=true;
    if(state.playhead>=c.start&&state.playhead<c.end)renderTextOverlays(activeTextEntries(state.playhead));
    markDirty(false);
  }

  function bindInspector() {
    ['insStart','insEnd','insMotion','insMotionSpeed','insScale','insPosX','insPosY','insCropTop','insCropRight','insCropBottom','insCropLeft','insFit','insTransition','insSourceIn','insSourceOut','insSourceAudio','insSourceVolume','insSourceFadeIn','insSourceFadeOut','insSubtitleText','insSubtitleSize','insSubtitlePosition','insTextFont','insTextPosX','insTextPosY','insLock','insVolume','insFadeIn','insFadeOut','insDucking'].forEach(id => $(id).addEventListener('change',()=>applyInspectorChange()));
    $('insSourceAudio').addEventListener('change',()=>{$('insSourceVolume').disabled=!$('insSourceAudio').checked;});
    $('insSubtitleText').addEventListener('input',()=>previewTextInspectorEdit());
    $('insSubtitleSize').addEventListener('input',()=>previewTextInspectorEdit());
    $('insTextFont').addEventListener('input',()=>previewTextInspectorEdit());
    $('insTextPosX').addEventListener('input',()=>previewTextInspectorEdit());
    $('insTextPosY').addEventListener('input',()=>previewTextInspectorEdit());
    $('insVolume').addEventListener('input',()=>{const c=getSelectedClip();if(!c||!['audio','narration'].includes(trackKind(state.selectedTrack)))return;c.volume=clamp($('insVolume').value,0,1);state.project.ui.track_volume[state.selectedTrack]=c.volume;applyPreviewAudioLevels();markDirty(false);});
    $('insDuration').addEventListener('change',()=>{const c=getSelectedClip();if(!c||isIntroClip(c))return;const d=Math.max(.1,Number($('insDuration').value)||.1);$('insEnd').value=round3(c.start+d);applyInspectorChange('Change duration');});
    $('insManual').addEventListener('change',()=>{const c=getSelectedClip();if(!c)return;c.manual_override=$('insManual').checked;markDirty(true,'Manual override');renderAll();});
    $('insVisualSource').addEventListener('change',e=>replaceSelectedWithAsset(e.target.value));
    $('setStartBtn').onclick=()=>{const c=getSelectedClip();if(!c||isIntroClip(c))return;$('insStart').value=state.playhead;applyInspectorChange('Set scene start');};
    $('setEndBtn').onclick=()=>{const c=getSelectedClip();if(!c||isIntroClip(c))return;$('insEnd').value=state.playhead;applyInspectorChange('Set scene end');};
    $('saveClipBtn').onclick=async()=>{applyInspectorChange('Save manual edit');await saveProject();toast('Edit manual disimpan dan dilindungi dari Auto Sync.');};
  }

  function syncAudioSource() {
    const clips=state.project.timeline.tracks.narration||[];
    if(!clips.length){const audio=$('masterAudio');audio.pause();audio.removeAttribute('src');delete audio.dataset.src;delete audio.dataset.clipId;audio.load();if(state.wave){try{state.wave.destroy();}catch{}state.wave=null;}$('waveform').innerHTML='';return;}
    if(!loadNarrationForTime(state.playhead,false)){$('masterAudio').pause();}
  }

  function narrationAt(t){
    const clips=state.project?.timeline?.tracks?.narration||[];
    return clips.find(clip=>t>=clip.start&&t<clip.end)||(t===(state.project?.timeline?.duration||0)?clips.at(-1):null);
  }

  function applyPreviewAudioLevels(){
    const master=clamp($('masterVolume').value,0,1),narration=narrationAt(state.playhead);
    $('masterAudio').volume=clamp(master*(narration&&audibleTrack('narration')?Number(narration.volume??1):0),0,1);
    const visual=(state.project?.timeline?.tracks?.video||[]).find(clip=>state.playhead>=clip.start&&state.playhead<clip.end),sourceVolume=visual&&visual.type==='video'&&!isIntroClip(visual)?Number(visual.volume)||0:1;$('previewVideo').volume=clamp(master*sourceVolume,0,1);
    for(const [id,audio] of state.mixAudios){const clip=trackDefinitions().filter(track=>track.kind==='audio').flatMap(track=>state.project.timeline.tracks[track.id]||[]).find(item=>item.id===id);audio.volume=clamp(master*Number(clip?.volume??0),0,1);}
  }

  function playbackRate(){return clamp($('playbackSpeed')?.value||1,.25,2);}
  function applyPlaybackRate(){const rate=playbackRate();$('masterAudio').playbackRate=rate;$('previewVideo').playbackRate=rate;for(const audio of state.mixAudios.values())audio.playbackRate=rate;if(state.silentPlayback){state.silentPlayback={from:state.playhead,started:performance.now(),direction:state.silentPlayback.direction||1};}}

  function playMasterAudio(){
    const audio=$('masterAudio');state.silentPlayback=null;audio.play().then(()=>{cancelAnimationFrame(state.previewRAF);playbackLoop();$('playPauseBtn').innerHTML='<i class="bi bi-pause-fill"></i>';}).catch(error=>toast(error.message,4000));
  }

  function loadNarrationForTime(globalTime,shouldPlay=false){
    const clip=narrationAt(globalTime);if(!clip)return null;
    const audio=$('masterAudio'),localTime=Math.max(0,Math.min(clipDuration(clip),globalTime-clip.start));
    audio.volume=clamp(Number($('masterVolume').value)*(audibleTrack('narration')?Number(clip.volume??1):0),0,1);audio.playbackRate=playbackRate();
    const applyTime=()=>{try{audio.currentTime=localTime;}catch{}if(shouldPlay)playMasterAudio();};
    if(audio.dataset.clipId!==clip.id||audio.dataset.src!==clip.source){audio.pause();audio.src=clip.source;audio.dataset.src=clip.source;audio.dataset.clipId=clip.id;audio.load();audio.addEventListener('loadedmetadata',applyTime,{once:true});initWaveform(true);}else{applyTime();}
    return clip;
  }

  function initWaveform(force=false) {
    const narrationClips=state.project?.timeline?.tracks?.narration||[],narration=narrationClips[0]; if(!narration||!window.WaveSurfer)return;
    if(narrationClips.length>1){if(state.wave){try{state.wave.destroy();}catch{}state.wave=null;}$('waveform').innerHTML='';return;}
    if(force && state.wave){try{state.wave.destroy();}catch{} state.wave=null;}
    if(!state.wave){
      $('waveform').innerHTML='';
      try{
        state.wave=WaveSurfer.create({container:'#waveform',height:52,waveColor:'#426a5b',progressColor:'#62b592',cursorWidth:0,interact:true,normalize:true,url:narration.source,minPxPerSec:state.pixelsPerSecond,fillParent:false,hideScrollbar:true});
        state.wave.on('interaction',()=>seekTo(state.wave.getCurrentTime()));
      }catch(e){console.warn('WaveSurfer unavailable',e);}
    } else {
      try{state.wave.setOptions({minPxPerSec:state.pixelsPerSecond});}catch{}
    }
  }

  const previewVideoPlayback=window.FrameSyncVideoPlayback.createVideoPlaybackController();
  let previewVideoNeedsSeek=false;
  function seekTo(t) {
    previewVideoNeedsSeek=true;
    t=Math.max(0,Math.min(state.project.timeline.duration||0,t));const wasPlaying=isPreviewPlaying();state.playhead=t;if(!loadNarrationForTime(t,wasPlaying)&&wasPlaying)startSilentPlayback(t);if(state.wave){try{state.wave.setTime(t);}catch{}}
    updatePreview(t); $('playhead').style.left=`${t*state.pixelsPerSecond}px`; updateTimeDisplay();
  }

  function activeClip(track,t){ return (state.project.timeline.tracks[track]||[]).find(c=>t>=c.start && t<c.end) || null; }
  function activeVisualClip(t){return [...trackDefinitions()].reverse().filter(track=>track.kind==='image'&&visibleTrack(track.id)).map(track=>activeClip(track.id,t)).find(Boolean)||null;}
  function activeTextEntries(t){const entries=[];for(const track of trackDefinitions().filter(track=>track.kind==='text'&&visibleTrack(track.id)&&(track.id!=='subtitle'||state.project.ui.caption_enabled===true)))for(const clip of state.project.timeline.tracks[track.id]||[])if(t>=clip.start&&t<clip.end)entries.push({track:track.id,clip});return entries;}
  function syncMixAudio(t,playing){
    const active=[];for(const track of trackDefinitions().filter(item=>item.kind==='audio'&&audibleTrack(item.id)))for(const clip of state.project.timeline.tracks[track.id]||[])if(t>=clip.start&&t<clip.end)active.push(clip);
    const ids=new Set(active.map(clip=>clip.id));for(const [id,audio] of state.mixAudios)if(!ids.has(id)){audio.pause();state.mixAudios.delete(id);}
    for(const clip of active){let audio=state.mixAudios.get(clip.id);if(!audio){audio=new Audio(clip.source);audio.loop=true;state.mixAudios.set(clip.id,audio);}audio.playbackRate=playbackRate();audio.volume=Math.max(0,Math.min(1,Number($('masterVolume').value)*Number(clip.volume??.1)));const local=Math.max(0,t-clip.start);if(Math.abs((audio.currentTime||0)-local)>.3)try{audio.currentTime=local;}catch{}if(playing)audio.play().catch(()=>{});else audio.pause();}
  }
  function renderSubtitleOverlay(caption,track,overlay){
    const content=overlay.querySelector('.subtitle-text-content'),text=String(caption?.text||'');if(document.activeElement!==content)content.textContent=text;
    overlay.className=`subtitle-overlay caption-style-${caption?.caption_style||'classic'} is-visible${state.selected===caption.id&&state.selectedTrack===track?' is-selected':''}`;overlay.dataset.outputFontSize=String(captionOutputFontSize(caption));overlay.dataset.track=track;overlay.dataset.clipId=caption.id;
    overlay.style.fontFamily=caption.font_family||'Arial';
    overlay.style.left=`${clamp(50+Number(caption.position_x||0),0,100)}%`;overlay.style.top=`${clamp(textBaseY(caption)+Number(caption.position_y||0),0,100)}%`;overlay.style.right='auto';overlay.style.bottom='auto';overlay.style.transform='translate(-50%,-50%)';
  }
  function renderTextOverlays(entries){const layer=$('textOverlayLayer'),keys=new Set(entries.map(entry=>selectedKey(entry.track,entry.clip.id)));qsa('.subtitle-overlay',layer).forEach(overlay=>{if(!keys.has(overlay.dataset.overlayKey))overlay.remove();});for(const entry of entries){const key=selectedKey(entry.track,entry.clip.id);let overlay=qsa('.subtitle-overlay',layer).find(item=>item.dataset.overlayKey===key);if(!overlay){overlay=document.createElement('div');overlay.dataset.overlayKey=key;overlay.innerHTML='<button class="text-drag-handle" type="button" title="Geser posisi text di video" aria-label="Geser posisi text di video"><i class="bi bi-arrows-move"></i></button><span class="subtitle-text-content" contenteditable="true" spellcheck="false"></span>';layer.appendChild(overlay);}renderSubtitleOverlay(entry.clip,entry.track,overlay);}updateSubtitlePreviewScale();}
  function updatePreview(t) {
    if(!state.project)return;
    state.playhead=t;
    const c=activeVisualClip(t),textEntries=activeTextEntries(t),img=$('previewImage'),video=$('previewVideo'),stage=$('previewStage');
    syncMixAudio(t,isPreviewPlaying()&&state.silentPlayback?.direction!==-1);
    if(!c){img.style.display='none';video.style.display='none';video.pause();previewVideoPlayback.reset();$('emptyPreview').style.display=textEntries.length?'none':'flex';$('previewBadge').textContent=textEntries.length?'Text overlay':'No clip';renderTextOverlays(textEntries);updateTimeDisplay();return;}
    $('emptyPreview').style.display='none';
    if(c.type==='video'){
      img.style.display='none';video.style.display='block';
      const sourceAudio=isIntroClip(c)||!!c.metadata?.source_audio_enabled;
      video.muted=!sourceAudio||state.silentPlayback?.direction===-1;
      video.volume=clamp(Number($('masterVolume').value)*(isIntroClip(c)?1:Number(c.volume)||0),0,1);
      const clipLength=Math.max(.001,clipDuration(c)),local=Math.max(0,Math.min(clipLength,t-c.start));
      const sourceStart=Math.max(0,Number(c.metadata?.source_offset)||0),sourceEnd=Math.max(sourceStart,Number(c.metadata?.source_end)||sourceStart+clipLength);
      previewVideoPlayback.sync(video,{clipId:c.id,source:c.source,sourceStart,sourceEnd,duration:clipLength,time:local,playing:isPreviewPlaying(),rate:playbackRate(),direction:state.silentPlayback?.direction||1,forceSeek:previewVideoNeedsSeek});
      previewVideoNeedsSeek=false;
      $('previewBadge').textContent=`${isIntroClip(c)?'INTRO':'B-ROLL'} · ${fileName(c.source)}`;
      $('previewBlurBg').style.backgroundImage='none';applyMotion(video,c,local/clipLength);
    }else{video.pause();previewVideoPlayback.reset();video.style.display='none';img.style.display='block';if(img.getAttribute('src')!==c.source)img.src=c.source;$('previewBadge').textContent=`${c.confidence||''} · ${fileName(c.source)}`;$('previewBlurBg').style.backgroundImage=`url("${c.source}")`;const p=Math.max(0,Math.min(1,(t-c.start)/Math.max(.001,clipDuration(c))));applyMotion(img,c,p);}
    stage.classList.remove('fit-cover','fit-contain','fit-blur_background'); stage.classList.add(`fit-${c.fit_mode||'cover'}`);
    renderTextOverlays(textEntries);
    updateTimeDisplay();
  }

  function applyMotion(img,c,p) {
    const t=Math.max(0,Math.min(1,p)),ease=t*t*t*(t*(t*6-15)+10),duration=clipDuration(c);let strength={fast:2,normal:1.5,subtle:1,slow:1.2}[c.motion_speed]??1;if(c.metadata?.motion_reason==='dramatic')strength*=1.2;const zoom=Math.min(.12,Math.max(.04,Math.min(.07,.04+(duration-5)*.0067))*strength),pan=Math.min(.08,Math.max(.025,Math.min(.05,.02+duration*.003))*strength),viewWidth=img.clientWidth||$('previewStage').clientWidth||500,viewHeight=img.clientHeight||$('previewStage').clientHeight||281,travel=2*ease-1;let scale=Number(c.scale)||1,x=Number(c.position_x)||0,y=Number(c.position_y)||0;
    switch(c.motion){case'zoom_in':scale*=1+zoom*ease;break;case'zoom_out':scale*=1+zoom*(1-ease);break;case'pan_left':scale*=1+pan*1.15;x-=.5*pan*viewWidth*travel;break;case'pan_right':scale*=1+pan*1.15;x+=.5*pan*viewWidth*travel;break;case'pan_up':scale*=1+pan*1.15;y-=.5*pan*viewHeight*travel;break;case'pan_down':scale*=1+pan*1.15;y+=.5*pan*viewHeight*travel;break;case'ken_burns':case'random_cinematic':scale*=1+zoom*ease;x+=pan*viewWidth*(ease-.5);y+=.35*pan*viewHeight*(.5-ease);break;}
    img.style.transform=`translate(${x}px,${y}px) scale(${scale})`; const crop=c.crop||{}; img.style.clipPath=`inset(${crop.top||0}% ${crop.right||0}% ${crop.bottom||0}% ${crop.left||0}%)`;
    const td=Math.max(0,Number(c.transition_duration)||0),opacityTransitions=new Set(['crossfade','fade','dissolve']); let opacity=1; if(td>0 && opacityTransitions.has(c.transition_in||'none') && p < td/Math.max(.001,clipDuration(c))) opacity=Math.min(opacity,(p*clipDuration(c))/td); if(td>0 && opacityTransitions.has(c.transition_out||'none') && (1-p) < td/Math.max(.001,clipDuration(c))) opacity=Math.min(opacity,((1-p)*clipDuration(c))/td); img.style.opacity=String(Math.max(0,Math.min(1,opacity)));
  }

  function updateTimeDisplay(){ $('timeDisplay').textContent=`${fmt(state.playhead)} / ${fmt(state.project?.timeline?.duration||0)}`; }
  function isPreviewPlaying(){return !!state.silentPlayback||!$('masterAudio').paused;}
  function stopPreviewPlayback(){state.silentPlayback=null;$('masterAudio').pause();$('previewVideo').pause();previewVideoPlayback.reset();for(const audio of state.mixAudios.values())audio.pause();cancelAnimationFrame(state.previewRAF);$('playPauseBtn').innerHTML='<i class="bi bi-play-fill"></i>';}
  function startSilentPlayback(from=state.playhead,direction=1){$('masterAudio').pause();$('previewVideo').muted=direction<0;$('previewVideo').volume=Number($('masterVolume').value);$('previewVideo').playbackRate=playbackRate();state.silentPlayback={from,started:performance.now(),direction};cancelAnimationFrame(state.previewRAF);$('playPauseBtn').innerHTML='<i class="bi bi-pause-fill"></i>';playbackLoop();}
  function loopBoundary(){const loop=state.project.ui.loop_range;return loop?.enabled&&loop.out>loop.in?loop:null;}
  function playbackLoop(){const audio=$('masterAudio'),loop=loopBoundary();if(state.silentPlayback){const direction=state.silentPlayback.direction||1,elapsed=(performance.now()-state.silentPlayback.started)/1000*playbackRate()*direction;state.playhead=clamp(state.silentPlayback.from+elapsed,0,state.project.timeline.duration);if(direction>0){const next=(state.project.timeline.tracks.narration||[]).find(clip=>clip.start>=state.silentPlayback.from&&clip.start<=state.playhead+.02);if(next){state.playhead=next.start;state.silentPlayback=null;loadNarrationForTime(next.start,true);return;}}if(loop&&((direction>0&&state.playhead>=loop.out)||(direction<0&&state.playhead<=loop.in))){startSilentPlayback(direction>0?loop.in:loop.out,direction);return;}updatePreview(state.playhead);$('playhead').style.left=`${state.playhead*state.pixelsPerSecond}px`;if(state.playhead<=0||state.playhead>=state.project.timeline.duration){stopPreviewPlayback();return;}state.previewRAF=requestAnimationFrame(playbackLoop);return;}const clip=(state.project.timeline.tracks.narration||[]).find(item=>item.id===audio.dataset.clipId);if(!audio.paused&&clip){state.playhead=Math.min(clip.end,clip.start+audio.currentTime);if(loop&&state.playhead>=loop.out){audio.pause();state.playhead=loop.in;if(!loadNarrationForTime(loop.in,true))startSilentPlayback(loop.in);return;}updatePreview(state.playhead);$('playhead').style.left=`${state.playhead*state.pixelsPerSecond}px`;if(state.wave){try{state.wave.setTime(audio.currentTime);}catch{}}state.previewRAF=requestAnimationFrame(playbackLoop);}}
  function togglePlay(){const clips=state.project.timeline.tracks.narration||[],audio=$('masterAudio');if(!clips.length){const intro=introClip();if(intro){startSilentPlayback(state.playhead>=intro.end?0:state.playhead);return;}toast('Run Auto Sync first.');return;}if(isPreviewPlaying()){stopPreviewPlayback();return;}if(narrationAt(state.playhead))loadNarrationForTime(state.playhead,true);else startSilentPlayback(state.playhead);}

  function advanceNarration(){const clips=state.project.timeline.tracks.narration||[],index=clips.findIndex(clip=>clip.id===$('masterAudio').dataset.clipId);if(index>=0&&index<clips.length-1){state.playhead=clips[index+1].start;loadNarrationForTime(state.playhead,true);}else{$('playPauseBtn').innerHTML='<i class="bi bi-play-fill"></i>';}}

  function nextScene(dir=1){const clips=state.project.timeline.tracks.video||[];if(!clips.length)return;let idx=clips.findIndex(c=>state.playhead>=c.start&&state.playhead<c.end);if(idx<0)idx=0;idx=Math.max(0,Math.min(clips.length-1,idx+dir));seekTo(clips[idx].start+.001);}
  function stepFrame(direction){stopPreviewPlayback();const fps=Math.max(1,Number(state.project.timeline.settings.fps)||Number($('renderFps').value)||30);seekTo(state.playhead+direction/fps);}
  function setLoopPoint(kind){const loop=state.project.ui.loop_range;if(kind==='in'){loop.in=round3(state.playhead);if(loop.out<=loop.in)loop.out=round3(Math.min(state.project.timeline.duration,loop.in+1));}else{loop.out=round3(state.playhead);if(loop.out<=loop.in)loop.in=round3(Math.max(0,loop.out-1));}loop.enabled=loop.out>loop.in;markDirty(true,`Set loop ${kind}`);renderRuler();renderPlaybackControls();}
  function toggleLoop(){const loop=state.project.ui.loop_range;if(loop.out<=loop.in){loop.in=0;loop.out=state.project.timeline.duration;}loop.enabled=!loop.enabled;markDirty(true,loop.enabled?'Enable loop':'Disable loop');renderRuler();renderPlaybackControls();}
  function addMarker(){const marker=round3(state.playhead),markers=state.project.ui.markers;if(markers.some(value=>Math.abs(value-marker)<.02)){toast('Marker sudah ada di posisi ini.');return;}markers.push(marker);markers.sort((a,b)=>a-b);markDirty(true,'Add marker');renderRuler();toast(`Marker ditambah pada ${fmt(marker)}.`);}
  function renderPlaybackControls(){const loop=state.project?.ui?.loop_range;$('loopToggleBtn').classList.toggle('is-active',!!loop?.enabled);$('loopInBtn').title=`Set awal loop (I). Saat ini ${fmt(loop?.in||0)}`;$('loopOutBtn').title=`Set akhir loop (O). Saat ini ${fmt(loop?.out||0)}`;}

  function lowReviewRows(){
    return (state.project?.timeline?.tracks?.video||[]).filter(c=>!isIntroClip(c)).flatMap(c=>
      c.manual_override||c.locked?[]:(c.metadata?.aligned_beats?.length?c.metadata.aligned_beats:[{start:c.start,confidence:c.confidence}])
        .filter(b=>(b.confidence||c.confidence||'LOW')==='LOW').map(b=>({id:c.id,start:b.start}))
    ).sort((a,b)=>a.start-b.start);
  }
  function reviewNextLow(){
    const rows=lowReviewRows();
    if(!rows.length){toast('Tidak ada kalimat LOW confidence.');return;}
    const next=rows.find(row=>row.start>state.playhead+.01)||rows[0];state.selectedTrack='video';state.selected=next.id;state.selectedClips=[selectedKey('video',next.id)];seekTo(next.start+.001);renderScenes();renderTimeline();renderInspector();
  }

  function addVisualAssetAtPlayhead(asset,type,track='video'){
    const clips=state.project.timeline.tracks[track]||[],intro=introClip(),start=intro&&state.playhead<intro.end?intro.end:state.playhead,active=clips.find(c=>!isIntroClip(c)&&start>=c.start&&start<c.end);
    if(active){replaceClipVisual(active,asset,type);state.selected=active.id;state.selectedTrack=track;state.selectedClips=[selectedKey(track,active.id)];markDirty(true,type==='video'?'Replace scene with B-roll':'Replace scene image');renderAll();return;}
    const next=[...clips].filter(c=>c.start>=start).sort((a,b)=>a.start-b.start)[0],desired=type==='video'?Math.max(.1,Number(asset.duration)||5):5,end=round3(Math.min(start+desired,next?.start??Infinity));
    if(end-start<.1){toast('Tidak ada ruang kosong pada track visual.');return;}
    const c={id:uid('clip'),type,source:asset.source,start:round3(start),end,duration:round3(end-start),motion:type==='video'?'static':'zoom_in',motion_speed:'slow',transition_in:'crossfade',transition_out:'crossfade',transition_duration:.4,locked:false,manual_override:true,semantic_score:0,confidence:'LOW',fit_mode:'cover',scale:1,position_x:0,position_y:0,crop:{},volume:type==='video'?0:1,fade_in:0,fade_out:0,metadata:{asset_id:asset.id,suggestions:[],manual_added:true,manual_revision:Date.now(),...(type==='video'?{role:'broll',source_offset:0,source_end:Math.min(Number(asset.duration)||0,end-start),source_duration:Math.min(Number(asset.duration)||0,end-start),source_audio_enabled:false}:{})}};
    state.project.timeline.tracks[track].push(c);state.project.timeline.tracks[track].sort((a,b)=>a.start-b.start);extendDuration();state.selected=c.id;state.selectedTrack=track;state.selectedClips=[selectedKey(track,c.id)];markDirty(true,type==='video'?'Add B-roll video':'Add image');renderAll();
  }
  function addImageAtPlayhead(asset,track='video'){addVisualAssetAtPlayhead(asset,'image',track);}
  function addVideoAtPlayhead(asset,track='video'){addVisualAssetAtPlayhead(asset,'video',track);}

  function addMusicAsset(asset,track='music',start=state.playhead){const available=Math.max(.1,(state.project.timeline.duration||asset.duration||30)-start),d=Math.min(asset.duration||available,available),volume=clamp(state.project.ui.track_volume[track]??.1,0,1);const c={id:uid('music'),type:'audio',source:asset.source,start,end:start+d,duration:d,locked:false,manual_override:true,volume,fade_in:1,fade_out:1,metadata:{asset_id:asset.id}};state.project.timeline.tracks[track].push(c);state.project.timeline.tracks[track].sort((a,b)=>a.start-b.start);state.selected=c.id;state.selectedTrack=track;state.selectedClips=[selectedKey(track,c.id)];extendDuration();markDirty(true,'Add audio');renderAll();}

  function addTextAtPlayhead(track){const d=3,c={id:uid('text'),type:'subtitle',source:'',start:state.playhead,end:state.playhead+d,duration:d,locked:false,manual_override:true,text:'Text baru',font_size:42,font_family:'Arial',subtitle_position:'center',caption_style:'classic',position_x:0,position_y:0,volume:1,fade_in:0,fade_out:0,metadata:{manual_text:true}};state.project.timeline.tracks[track].push(c);state.selected=c.id;state.selectedTrack=track;state.selectedClips=[selectedKey(track,c.id)];extendDuration();markDirty(true,'Add text overlay');renderAll();setTimeout(()=>qsa('.subtitle-overlay',$('textOverlayLayer')).find(overlay=>overlay.dataset.track===track&&overlay.dataset.clipId===c.id)?.querySelector('.subtitle-text-content')?.focus(),0);}

  function addTrack(kind,deferRender=false){
    const prefixes={image:'V',audio:'A',text:'T'},labels={image:'Visual / Gambar',audio:'Audio',text:'Text Overlay'},starts={image:2,audio:3,text:1};let number=starts[kind];
    while(state.project.ui.extra_tracks.some(track=>track.id===`${kind}_${number}`||track.code===`${prefixes[kind]}${number}`))number+=1;const id=`${kind}_${number}`;
    state.project.ui.extra_tracks.push({id,kind,code:`${prefixes[kind]}${number}`,label:labels[kind]});state.project.ui.track_visibility[id]=true;state.project.ui.track_solo[id]=false;if(kind==='audio')state.project.ui.track_volume[id]=1;state.project.timeline.tracks[id]=[];
    state.selectedTrack=id;state.selected=null;state.selectedClips=[];if(!deferRender){markDirty(true,'Add track');renderTimeline();renderInspector();toast(kind==='text'?'Text track ditambahkan. Tekan Add Text untuk membuat text overlay.':`${labels[kind]} track ditambahkan. Drag asset ke lane baru.`);}return id;
  }

  function addTextOverlay(){let track=state.selectedTrack!=='subtitle'&&trackKind(state.selectedTrack)==='text'?state.selectedTrack:state.project.ui.extra_tracks.find(item=>item.kind==='text')?.id;if(!track)track=addTrack('text',true);addTextAtPlayhead(track);}

  function deleteTrack(id){
    const track=state.project.ui.extra_tracks.find(item=>item.id===id);if(!track)return;const clips=state.project.timeline.tracks[id]||[];
    if(clips.length&&!confirm(`Hapus ${track.label} beserta ${clips.length} clip?`))return;
    state.project.ui.extra_tracks=state.project.ui.extra_tracks.filter(item=>item.id!==id);delete state.project.timeline.tracks[id];delete state.project.ui.track_visibility[id];delete state.project.ui.track_solo[id];delete state.project.ui.track_volume[id];
    if(state.selectedTrack===id){state.selectedTrack='video';state.selected=null;state.selectedClips=[];}
    markDirty(true,'Delete track');renderAll();
  }

  function reorderNarration(sourceId,targetId){
    const order=[...(state.project.ui.narration_sequence_ids||[])];
    const from=order.indexOf(sourceId),to=order.indexOf(targetId);if(from<0||to<0||from===to)return;
    order.splice(from,1);order.splice(to,0,sourceId);state.project.ui.narration_sequence_ids=order;
    markDirty(true,'Reorder voice');renderAssets();toast('Voice order updated. Press Analyze to rebuild the timeline.');
  }

  function reorderImages(sourceId,targetId){
    const images=state.project.assets.images;
    const from=images.findIndex(asset=>asset.id===sourceId),to=images.findIndex(asset=>asset.id===targetId);if(from<0||to<0||from===to)return;
    const [moved]=images.splice(from,1);images.splice(to,0,moved);
    markDirty(true,'Reorder images');renderAssets();toast('Image order updated. Analyze will follow this story order.');
  }

  async function deleteUploadedAsset(kind,assetId){
    const asset=(state.project.assets[kind]||[]).find(item=>item.id===assetId);if(!asset)return;
    if(!confirm(`Delete "${asset.name}"? Timeline references to this asset will also be removed.`))return;
    if(kind==='audio'&&voicePreviewAssetId===assetId)stopVoicePreview();
    try{state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/assets/${kind}/${assetId}`,{method:'DELETE'}));state.selected=null;state.selectedClips=[];renderAll();toast(`${asset.name} deleted.`);}catch(e){toast(e.message,5000);}
  }

  async function uploadAssets() {
    if(!state.project)return; const input=$('assetInput');input.multiple=state.assetKind!=='intro';input.accept=state.assetKind==='images'?'image/*':state.assetKind==='audio'||state.assetKind==='music'?'audio/*':['videos','intro'].includes(state.assetKind)?'video/mp4,video/quicktime,video/webm,.m4v':'*/*';input.value='';input.click();
  }
  async function handleFiles(files){if(!files.length)return;const kind=state.assetKind;if(kind==='intro'&&files.length!==1){toast('Pilih tepat satu video intro.',4000);return;}const fd=new FormData();[...files].forEach(f=>fd.append('files',f));toast(kind==='intro'?'Menyiapkan video intro…':'Uploading assets…');try{await api(`${API}/projects/${state.project.id}/assets/${kind}`,{method:'POST',body:fd});state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}`));state.selected=null;state.selectedClips=[];renderAll();toast(kind==='audio'?'Voice ditambahkan ke akhir sequence. Geser kartu untuk mengubah urutan.':kind==='intro'?'Intro dipasang di awal beserta suara aslinya. Isi timeline telah digeser.':'Upload complete.',kind==='intro'?5000:2200);}catch(e){toast(e.message,5000);} }

  async function runAutoSync(force=false,scope='all'){
    if(!state.project)return;stopVoicePreview(); $('autoSyncBtn').disabled=true; $('autoSyncBtn').innerHTML='<span class="spinner-border spinner-border-sm"></span> Analyzing…';
    const targetClipSeconds=selectedSceneSeconds();
    try{
      const limitedMode=await ensureLocalAi();
      const narrationAssetIds=state.project.ui.narration_sequence_ids||[],language=state.project.ui.narration_language||'id';
      state.project.ui.auto_sync_mode=targetClipSeconds==null?'auto':'manual';
      if(targetClipSeconds!=null)state.project.ui.auto_sync_seconds=targetClipSeconds;
      state.dirty=true;await saveProject();if(state.dirty)return;
      const coverage=state.project.ui.alignment_mode==='coverage';
      const path=coverage?'/auto-sync/preview':'/auto-sync';
      const result=await api(`${API}/projects/${state.project.id}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({alignment_mode:state.project.ui.alignment_mode||'legacy',force,scope,target_clip_seconds:targetClipSeconds,narration_mode:'sequence',narration_asset_ids:narrationAssetIds,language,limited_mode:limitedMode})});
      if(coverage){showCoverageReview(result);return;}
      state.project=sanitizeProject(result);state.history=[];state.historyIndex=-1;snapshot('Auto Sync');state.dirty=false;state.selected=null;state.selectedClips=[];renderAll();
      toast(state.project.ui.last_sync_warning||`${state.project.timeline.tracks.video.length} scenes synced.`,state.project.ui.last_sync_warning?7000:3500);
    }
    catch(e){toast(e.message,5000);}finally{$('autoSyncBtn').disabled=false;$('autoSyncBtn').innerHTML='<i class="bi bi-magic"></i> Analyze & Auto Sync';}
  }

  let coverageDraft=null;
  function showCoverageReview(draft){
    coverageDraft=draft;
    const low=draft.rows.filter(row=>row.low).length;
    $('coverageReviewSummary').textContent=`${draft.coverage.used||0}/${draft.coverage.total||0} gambar wajib terpakai · ${draft.rows.length} shot · ${low} perlu review · solver ${draft.solver_status}. ${draft.warnings||''}`;
    $('coverageReviewRows').innerHTML=draft.rows.map(row=>`<div class="coverage-review-row"><img src="${escapeHtml(row.source||'')}" alt=""><div><strong>${fmt(row.start)}–${fmt(row.end)} · ${escapeHtml(row.confidence)}</strong><p>${escapeHtml(row.text||'')}</p><small>${escapeHtml(row.reason||'')}</small>${row.low?`<label class="d-block mt-2"><input class="form-check-input coverage-accept" type="checkbox" value="${escapeHtml(row.clip_id)}"> Saya sudah memeriksa pasangan ini</label>`:''}</div></div>`).join('');
    $('coverageApplyBtn').disabled=low>0;
    qsa('.coverage-accept',$('coverageReviewRows')).forEach(box=>box.onchange=()=>{$('coverageApplyBtn').disabled=qsa('.coverage-accept:not(:checked)',$('coverageReviewRows')).length>0;});
    bootstrap.Modal.getOrCreateInstance($('coverageReviewModal')).show();
  }
  async function applyCoverageDraft(){
    if(!coverageDraft)return;
    const button=$('coverageApplyBtn');button.disabled=true;
    try{
      const accepted=qsa('.coverage-accept:checked',$('coverageReviewRows')).map(box=>box.value);
      const project=await api(`${API}/projects/${state.project.id}/auto-sync/apply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft_id:coverageDraft.draft_id,accepted_low_clip_ids:accepted})});
      coverageDraft=null;bootstrap.Modal.getOrCreateInstance($('coverageReviewModal')).hide();
      state.project=sanitizeProject(project);state.history=[];state.historyIndex=-1;snapshot('Auto Sync');state.dirty=false;state.selected=null;state.selectedClips=[];renderAll();
      toast('Cakupan AI diterapkan. Semua gambar wajib terpakai.',4000);
    }catch(error){toast(error.message,7000);button.disabled=false;}
  }

  function requestAutoSync(){
    const hasTimeline=(state.project?.timeline?.tracks?.video||[]).some(clip=>!isIntroClip(clip))||(state.project?.timeline?.tracks?.narration?.length||0)>0;
    $('syncChoiceMode').value=['coverage','storyboard'].includes(state.project.ui.alignment_mode)?state.project.ui.alignment_mode:'legacy';
    renderSyncModeExplanation();
    $('syncReplaceAllBtn').textContent=hasTimeline?(state.project.ui.alignment_mode==='coverage'?'Hitung Ulang Auto':'Override Semua'):'Mulai Sync';
    const synced=new Set((state.project.timeline.tracks.narration||[]).map(clip=>clip.metadata?.asset_id).filter(Boolean));
    const ordered=state.project.ui.narration_sequence_ids||[];
    const hasNewVoice=ordered.some(id=>!synced.has(id));
    $('syncNewVoiceBtn').disabled=!hasNewVoice;
    $('syncChoiceHint').innerHTML=hasNewVoice?'<strong>Hanya voice baru</strong> mempertahankan timeline lama dan menambahkan voice beserta image batch baru setelahnya. <strong>Hitung ulang / Override</strong> membuat ulang pilihan otomatis; pada Cakupan AI, clip manual dan terkunci tetap dilindungi.':'Tidak ada voice baru. Hitung ulang pilihan otomatis untuk membuat timeline baru; pada Cakupan AI, clip manual dan terkunci tetap dilindungi.';
    if(!hasTimeline){$('syncNewVoiceBtn').disabled=true;$('syncChoiceHint').textContent='Proyek belum memiliki timeline. Mulai Sync memakai mode yang dipilih di atas.';}
    bootstrap.Modal.getOrCreateInstance($('autoSyncConflictModal')).show();
  }

  function renderSyncModeExplanation(){
    const count=state.project?.assets?.images?.length||0;
    const mode=$('syncChoiceMode').value;
    const required=(state.project?.assets?.images||[]).filter(asset=>asset.metadata?.coverage_required!==false).length;
    const requiredVideos=(state.project?.assets?.videos||[]).filter(asset=>asset.metadata?.coverage_required===true).length;
    const invalid=[...(state.project?.assets?.images||[]),...(state.project?.assets?.videos||[])].filter(asset=>asset.metadata?.voice_group&&asset.metadata.voice_group!=='all'&&!(state.project?.assets?.audio||[]).some(voice=>voice.id===asset.metadata.voice_group));
    const hasTimeline=(state.project?.timeline?.tracks?.video||[]).some(clip=>!isIntroClip(clip));
    if(hasTimeline)$('syncReplaceAllBtn').textContent=mode==='coverage'?'Hitung Ulang Auto':'Override Semua';
    $('syncModeExplanation').textContent=mode==='coverage'
      ? `Cakupan AI: ${required} gambar wajib, ${requiredVideos} video wajib, ${(state.project?.assets?.audio||[]).length} voice. AI boleh mengubah urutan. ${invalid.length?`${invalid.length} aset punya kelompok voice yang tidak tersedia; perbaiki di preview aset.`:'Pasangan LOW harus direview sebelum timeline diterapkan.'}`
      : mode==='storyboard'
      ? `Storyboard: ${count} gambar tersedia. Semua gambar pada cakupan voice yang dipilih wajib terpakai sesuai urutan. Jika tidak memungkinkan, proses berhenti tanpa membuang gambar.`
      : `Semantic AI: sebagian dari ${count} gambar BOLEH tidak terpakai. Untuk memakai semuanya, pilih “Semua gambar · sesuai urutan”.`;
  }

  function confirmAutoSync(force,scope){
    const selectedMode=$('syncChoiceMode').value;
    if(['coverage','storyboard'].includes(selectedMode)||state.project.ui.alignment_mode!=='sentence')state.project.ui.alignment_mode=selectedMode;
    state.dirty=true;renderAutoSceneControl();
    bootstrap.Modal.getOrCreateInstance($('autoSyncConflictModal')).hide();
    runAutoSync(force,scope);
  }

  async function runAutoCaption(retranscribe=false){
    if(!state.project)return;
    const button=$('autoCaptionBtn'), targetClipSeconds=selectedSceneSeconds(), style=state.project.ui.caption_style||'classic';
    button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm"></span> Captioning…';
    try{
      await saveProject();
      const narrationAssetIds=state.project.ui.narration_sequence_ids||[],language=state.project.ui.narration_language||'id';
      state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}/auto-caption`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({style,retranscribe,target_clip_seconds:targetClipSeconds,max_words:7,narration_mode:'sequence',narration_asset_ids:narrationAssetIds,language})}));
      state.history=[];state.historyIndex=-1;snapshot('Auto Caption');state.dirty=false;state.selected=null;state.selectedClips=[];renderAll();
      toast(`${state.project.timeline.tracks.subtitle.length} captions generated with ${style} style.`);
    }catch(e){toast(e.message,5000);}finally{button.disabled=false;button.innerHTML='<i class="bi bi-badge-cc"></i> Auto Caption';}
  }

  function toggleCaptions(enabled){
    if(!state.project)return;
    const captions=state.project.timeline.tracks.subtitle||[];
    if(enabled&&!captions.length){renderCaptionState();toast('Press Auto Caption to generate captions first.');return;}
    state.project.ui.caption_enabled=!!enabled;markDirty(false);renderCaptionState();updatePreview(state.playhead);toast(enabled?'Caption activated.':'Caption deactivated. It will not appear in the rendered video.');
  }

  function applyCaptionStyle(style, applyAll=false){
    if(!state.project)return;
    const captions=state.project.timeline.tracks.subtitle||[];
    if(applyAll){state.project.ui.caption_style=style;captions.forEach(caption=>caption.caption_style=style);}
    else {const text=getSelectedClip();if(trackKind(state.selectedTrack)==='text'&&text)text.caption_style=style;if(state.selectedTrack==='subtitle')state.project.ui.caption_style=style;}
    markDirty(true,applyAll?'Style all captions':state.selectedTrack==='subtitle'?'Caption style':'Text style');renderAll();
  }

  function renderCaptionManager(){
    const term=$('captionSearch').value.trim().toLowerCase(),captions=state.project?.timeline?.tracks?.subtitle||[];
    $('captionManagerList').innerHTML=captions.map((caption,index)=>({caption,index})).filter(item=>String(item.caption.text||'').toLowerCase().includes(term)).map(({caption,index})=>`<div class="caption-manager-row" data-caption-id="${caption.id}"><span class="caption-number">${index+1}</span><input class="form-control form-control-sm caption-start" type="number" min="0" step="0.01" value="${round3(caption.start)}" aria-label="Waktu mulai caption ${index+1}"><input class="form-control form-control-sm caption-end" type="number" min="0" step="0.01" value="${round3(caption.end)}" aria-label="Waktu akhir caption ${index+1}"><textarea class="form-control form-control-sm caption-text" rows="2" aria-label="Isi caption ${index+1}">${escapeHtml(caption.text||'')}</textarea><div class="caption-row-actions"><button class="btn btn-sm btn-outline-secondary caption-seek" title="Pindah playhead"><i class="bi bi-play"></i></button><button class="btn btn-sm btn-outline-secondary caption-split" title="Split di tengah"><i class="bi bi-scissors"></i></button><button class="btn btn-sm btn-outline-secondary caption-merge" title="Gabung dengan caption berikutnya" ${index>=captions.length-1?'disabled':''}><i class="bi bi-union"></i></button></div></div>`).join('')||'<div class="text-secondary small p-3">Caption tidak ditemukan.</div>';
    qsa('.caption-manager-row').forEach(row=>{const id=row.dataset.captionId;row.querySelector('.caption-seek').onclick=()=>{const caption=(state.project.timeline.tracks.subtitle||[]).find(item=>item.id===id);if(caption)seekTo(caption.start);};row.querySelector('.caption-split').onclick=()=>splitManagedCaption(id);row.querySelector('.caption-merge').onclick=()=>mergeManagedCaption(id);});
  }
  function saveManagedCaptions(){for(const row of qsa('.caption-manager-row')){const caption=(state.project.timeline.tracks.subtitle||[]).find(item=>item.id===row.dataset.captionId);if(!caption)continue;const start=Math.max(0,Number(row.querySelector('.caption-start').value)||0),end=Math.max(start+.05,Number(row.querySelector('.caption-end').value)||start+.05);caption.start=round3(start);caption.end=round3(end);caption.duration=round3(end-start);caption.text=row.querySelector('.caption-text').value;caption.manual_override=true;}state.project.timeline.tracks.subtitle.sort((a,b)=>a.start-b.start);state.project.ui.caption_enabled=state.project.timeline.tracks.subtitle.length>0;markDirty(true,'Batch edit captions');renderAll();renderCaptionManager();toast('Semua perubahan caption disimpan.');}
  function splitManagedCaption(id){saveManagedCaptions();const captions=state.project.timeline.tracks.subtitle,caption=captions.find(item=>item.id===id);if(!caption||clipDuration(caption)<.12)return;const cut=round3((caption.start+caption.end)/2),words=String(caption.text||'').trim().split(/\s+/),half=Math.max(1,Math.ceil(words.length/2)),copy=deepClone(caption);caption.end=cut;caption.duration=round3(cut-caption.start);caption.text=words.slice(0,half).join(' ');copy.id=uid('sub');copy.start=cut;copy.duration=round3(copy.end-copy.start);copy.text=words.slice(half).join(' ')||caption.text;captions.push(copy);captions.sort((a,b)=>a.start-b.start);markDirty(true,'Split caption');renderAll();renderCaptionManager();}
  function mergeManagedCaption(id){saveManagedCaptions();const captions=state.project.timeline.tracks.subtitle,index=captions.findIndex(item=>item.id===id);if(index<0||index>=captions.length-1)return;const caption=captions[index],next=captions[index+1];caption.end=next.end;caption.duration=round3(caption.end-caption.start);caption.text=`${caption.text||''} ${next.text||''}`.trim();captions.splice(index+1,1);markDirty(true,'Merge captions');renderAll();renderCaptionManager();}
  function srtTime(seconds){const ms=Math.round(Math.max(0,seconds)*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
  function parseSrtTime(value){const match=String(value).trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);return match?Number(match[1])*3600+Number(match[2])*60+Number(match[3])+Number(match[4])/1000:NaN;}
  function parseSrt(text){return String(text).replace(/\r/g,'').trim().split(/\n{2,}/).map(block=>{const lines=block.split('\n'),timeIndex=lines.findIndex(line=>line.includes('-->'));if(timeIndex<0)return null;const [from,to]=lines[timeIndex].split('-->').map(parseSrtTime),value=lines.slice(timeIndex+1).join('\n').trim();if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||!value)return null;return {id:uid('sub'),type:'subtitle',source:'',start:round3(from),end:round3(to),duration:round3(to-from),text:value,font_size:42,subtitle_position:'bottom',caption_style:state.project.ui.caption_style||'classic',font_family:'Arial',position_x:0,position_y:0,locked:false,manual_override:true,metadata:{imported_srt:true}};}).filter(Boolean);}
  async function importSrt(file){if(!file)return;const captions=parseSrt(await file.text());if(!captions.length){toast('File SRT tidak berisi caption valid.',5000);return;}state.project.timeline.tracks.subtitle=captions;state.project.ui.caption_enabled=true;extendDuration();markDirty(true,'Import SRT');renderAll();renderCaptionManager();toast(`${captions.length} caption diimpor.`);}
  function exportSrt(){const captions=state.project?.timeline?.tracks?.subtitle||[];if(!captions.length){toast('Belum ada caption untuk diekspor.');return;}const content=captions.map((caption,index)=>`${index+1}\n${srtTime(caption.start)} --> ${srtTime(caption.end)}\n${caption.text||''}`).join('\n\n')+'\n',url=URL.createObjectURL(new Blob([content],{type:'application/x-subrip;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`${(state.project.name||'captions').replace(/[^a-z0-9_-]+/gi,'-')}.srt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  function replaceClipVisual(c,asset,type=asset.kind==='videos'?'video':'image'){c.type=type;c.source=asset.source;c.motion=type==='video'?'static':(c.motion==='static'?'zoom_in':c.motion);c.manual_override=true;c.metadata||={};c.metadata.asset_id=asset.id;c.metadata.manual_added=true;c.metadata.manual_revision=Date.now();delete c.metadata.image_order;delete c.metadata.virtual_shot_label;delete c.metadata.visual_candidate_id;delete c.metadata.shot_id;if(type==='video'){const sourceDuration=Math.min(Number(asset.duration)||0,clipDuration(c));c.volume=0;c.metadata.role='broll';c.metadata.source_offset=0;c.metadata.source_end=sourceDuration;c.metadata.source_duration=sourceDuration;c.metadata.source_audio_enabled=false;}else{delete c.metadata.role;delete c.metadata.source_offset;delete c.metadata.source_end;delete c.metadata.source_duration;delete c.metadata.source_audio_enabled;}}
  function replaceSelectedWithAsset(assetId){const c=getSelectedClip();if(!c||trackKind(state.selectedTrack)!=='image'||isIntroClip(c))return;const a=[...(state.project.assets.images||[]),...(state.project.assets.videos||[])].find(x=>x.id===assetId);if(!a)return;replaceClipVisual(c,a);markDirty(true,a.kind==='videos'?'Replace with B-roll':'Replace image');renderAll();}
  function replaceSelected(){const c=getSelectedClip();if(trackKind(state.selectedTrack)!=='image'||isIntroClip(c))return;state.assetKind=c.type==='video'?'videos':'images';qsa('.asset-filter').forEach(x=>x.classList.toggle('active',x.dataset.kind===state.assetKind));renderAssets();toast('Pilih image atau video B-roll dari Asset Library.');}

  function splitAtPlayhead(){const c=getSelectedClip();if(!c||isIntroClip(c)||trackKind(state.selectedTrack)==='narration')return;if(state.playhead<=c.start+.05||state.playhead>=c.end-.05){toast('Move playhead inside the selected clip.');return;}const originalStart=c.start,originalEnd=c.end,originalDuration=Math.max(.001,originalEnd-originalStart),originalSourceIn=Number(c.metadata?.source_offset)||0,originalSourceOut=Number(c.metadata?.source_end)||originalSourceIn+originalDuration;c.end=round3(state.playhead);c.duration=round3(c.end-c.start);c.manual_override=true;const b=deepClone(c);b.id=uid(c.type==='subtitle'?'sub':'clip');b.start=round3(state.playhead);b.end=originalEnd;b.duration=round3(b.end-b.start);b.manual_override=true;if(b.type==='video'){const sourceRatio=Math.max(0,originalSourceOut-originalSourceIn)/originalDuration,splitSource=Math.min(originalSourceOut,originalSourceIn+(b.start-originalStart)*sourceRatio);c.metadata.source_end=round3(splitSource);c.metadata.source_duration=round3(splitSource-originalSourceIn);b.metadata.source_offset=round3(splitSource);b.metadata.source_end=round3(originalSourceOut);b.metadata.source_duration=round3(originalSourceOut-splitSource);}state.project.timeline.tracks[state.selectedTrack].push(b);state.project.timeline.tracks[state.selectedTrack].sort((a,b)=>a.start-b.start);state.selected=b.id;state.selectedClips=[selectedKey(state.selectedTrack,b.id)];markDirty(true,'Split clip');renderAll();}
  function duplicateSelected(){copySelected();state.playhead=getSelectedClip()?.end||state.playhead;pasteClips();}
  function copySelected(){const entries=selectedEntries().length?selectedEntries():(getSelectedClip()?[{track:state.selectedTrack,id:state.selected}]:[]);state.clipboard=entries.map(entry=>({track:entry.track,clip:deepClone(findClip(entry.track,entry.id))}));if(state.clipboard.length)toast(`${state.clipboard.length} clip copied.`);}
  function pasteClips(){if(!state.clipboard.length)return;const earliest=Math.min(...state.clipboard.map(item=>item.clip.start)),latest=Math.max(...state.clipboard.map(item=>item.clip.end)),span=latest-earliest,tracks=new Set(state.clipboard.map(item=>item.track));if($('rippleToggle').checked)for(const track of tracks)for(const clip of state.project.timeline.tracks[track]||[])if(clip.start>=state.playhead){clip.start=round3(clip.start+span);clip.end=round3(clip.end+span);}const added=[];for(const item of state.clipboard){if(!state.project.timeline.tracks[item.track])continue;const clip=deepClone(item.clip),offset=clip.start-earliest;clip.id=uid(clip.type==='subtitle'?'text':'clip');clip.start=round3(state.playhead+offset);clip.end=round3(clip.start+clipDuration(item.clip));clip.duration=round3(clip.end-clip.start);clip.manual_override=true;if(trackKind(item.track)==='image'&&!$('rippleToggle').checked&&(state.project.timeline.tracks[item.track]||[]).some(existing=>existing.start<clip.end&&existing.end>clip.start)){continue;}state.project.timeline.tracks[item.track].push(clip);state.project.timeline.tracks[item.track].sort((a,b)=>a.start-b.start);added.push(selectedKey(item.track,clip.id));}if(!added.length){toast('Tidak ada ruang. Aktifkan Ripple atau pindahkan playhead.');return;}state.selectedClips=added;const primary=added[added.length-1],cut=primary.indexOf(':');state.selectedTrack=primary.slice(0,cut);state.selected=primary.slice(cut+1);extendDuration();markDirty(true,'Paste clips');renderAll();}
  function deleteSelected(){const entries=selectedEntries().length?selectedEntries():(getSelectedClip()?[{track:state.selectedTrack,id:state.selected}]:[]);if(entries.length===1&&isIntroClip(findClip(entries[0].track,entries[0].id))){deleteUploadedAsset('intro',findClip(entries[0].track,entries[0].id).metadata?.asset_id);return;}const byTrack=new Map();for(const entry of entries){const clip=findClip(entry.track,entry.id);if(!clip||clip.locked||isIntroClip(clip))continue;if(!byTrack.has(entry.track))byTrack.set(entry.track,[]);byTrack.get(entry.track).push({start:clip.start,end:clip.end,id:clip.id});}for(const [track,removed] of byTrack){state.project.timeline.tracks[track]=state.project.timeline.tracks[track].filter(clip=>!removed.some(item=>item.id===clip.id));if($('rippleToggle').checked)for(const clip of state.project.timeline.tracks[track]){const shift=removed.filter(item=>item.end<=clip.start+.001).reduce((sum,item)=>sum+item.end-item.start,0);clip.start=round3(Math.max(0,clip.start-shift));clip.end=round3(Math.max(clip.start+.1,clip.end-shift));}}state.selected=null;state.selectedClips=[];markDirty(true,'Delete clips');renderAll();}
  function toggleLock(){const c=getSelectedClip();if(!c||isIntroClip(c))return;c.locked=!c.locked;if(c.locked)c.manual_override=true;markDirty(true,c.locked?'Lock clip':'Unlock clip');renderAll();}
  function resetMotion(){const c=getSelectedClip();if(!c)return;c.motion='static';c.motion_speed='slow';c.scale=1;c.position_x=0;c.position_y=0;c.manual_override=true;markDirty(true,'Reset motion');renderAll();}
  function resetTransition(){const c=getSelectedClip();if(!c)return;c.transition_in='crossfade';c.transition_out='crossfade';c.transition_duration=.4;c.manual_override=true;markDirty(true,'Reset transition');renderAll();}

  function handleAssetDropOnClip(ev,track,id){let data;try{data=JSON.parse(ev.dataTransfer.getData('application/json'));}catch{return;}if(trackKind(track)==='image'&&['images','videos'].includes(data.kind)){state.selectedTrack=track;state.selected=id;state.selectedClips=[selectedKey(track,id)];replaceSelectedWithAsset(data.assetId);} }
  function handleTrackDrop(ev,track){ev.preventDefault();let data;try{data=JSON.parse(ev.dataTransfer.getData('application/json'));}catch{return;}const rect=ev.currentTarget.getBoundingClientRect();state.playhead=Math.max(0,(ev.clientX-rect.left)/state.pixelsPerSecond);const kind=trackKind(track);if(kind==='image'&&['images','videos'].includes(data.kind)){const a=(state.project.assets[data.kind]||[]).find(x=>x.id===data.assetId);if(a)addVisualAssetAtPlayhead(a,data.kind==='videos'?'video':'image',track);}if(kind==='audio'&&['music','audio'].includes(data.kind)){const a=(state.project.assets[data.kind]||[]).find(x=>x.id===data.assetId);if(a)addMusicAsset(a,track,state.playhead);} }

  function showContextMenu(x,y){const m=$('contextMenu');m.style.left=`${x}px`;m.style.top=`${y}px`;m.classList.remove('d-none');}
  function hideContextMenu(){$('contextMenu').classList.add('d-none');}

  function setZoom(pct){state.zoomPct=Math.max(25,Math.min(400,pct));state.pixelsPerSecond=state.basePixelsPerSecond*(state.zoomPct/100);$('zoomSlider').value=state.zoomPct;renderTimeline();updatePreview(state.playhead);}
  function updateZoomLabel(){$('zoomLabel').textContent=`${state.zoomPct}%`;}
  function fitTimeline(){const dur=Math.max(1,state.project.timeline.duration||1), avail=Math.max(400,$('timelineScroll').clientWidth-140);const p=(avail/dur/state.basePixelsPerSecond)*100;setZoom(Math.max(25,Math.min(400,Math.floor(p/25)*25)));}

  function renderRenderHistory(){const outputs=state.project?.ui?.render_outputs||[];$('renderHistoryList').innerHTML=[...outputs].map((entry,index)=>({entry,index})).reverse().map(({entry,index})=>{const settings=entry.settings||{},created=entry.created_at?new Date(entry.created_at).toLocaleString():'Waktu tidak diketahui';return `<div class="render-history-item"><div><strong>${escapeHtml(fileName(entry.file||'Video'))}</strong><small>${escapeHtml(created)} · ${escapeHtml(settings.resolution||'')} ${settings.fps||''} FPS · ${escapeHtml(settings.encoder||'')} · ${escapeHtml(settings.quality||'')}</small></div><div><a class="btn btn-sm btn-outline-success" href="${escapeHtml(entry.file||'#')}" download title="Download hasil render"><i class="bi bi-download"></i></a><button class="btn btn-sm btn-outline-danger delete-render" data-render-index="${index}" title="Hapus hasil render"><i class="bi bi-trash3"></i></button></div></div>`;}).join('')||'<div class="text-secondary small">Belum ada hasil render.</div>';qsa('.delete-render').forEach(button=>button.onclick=()=>deleteRender(Number(button.dataset.renderIndex)));}
  async function deleteRender(index){const entry=state.project.ui.render_outputs?.[index];if(!entry||!confirm(`Hapus hasil render "${fileName(entry.file)}"?`))return;try{await api(`${API}/projects/${state.project.id}/renders/${index}`,{method:'DELETE'});state.project.ui.render_outputs.splice(index,1);renderRenderHistory();toast('Hasil render dihapus.');}catch(error){toast(error.message,5000);}}

  async function startRender(){
    state.project.timeline.settings.fps=Number($('renderFps').value);state.project.timeline.settings.encoder=$('renderEncoder').value;state.project.timeline.settings.quality=$('renderQuality').value.toLowerCase();markDirty(false);await saveProject(); $('startRenderBtn').disabled=true;$('renderProgressWrap').classList.remove('d-none');$('cancelRenderBtn').classList.remove('d-none');$('renderOutputLink').classList.add('d-none');$('renderTimeInfo').classList.remove('text-danger');$('renderProgress').classList.remove('bg-danger');
    try{const req={resolution:state.project.timeline.settings.resolution,fps:Number($('renderFps').value),encoder:$('renderEncoder').value,quality:$('renderQuality').value.toLowerCase()};state.renderJob=await api(`${API}/projects/${state.project.id}/render`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});pollRender();}catch(e){toast(e.message,5000);$('startRenderBtn').disabled=false;}
  }
  async function pollRender(){if(!state.renderJob)return;try{const j=await api(`${API}/render/${state.renderJob.id}`);state.renderJob=j;const terminal=['failed','cancelled'].includes(j.status),failed=j.status==='failed';$('renderPct').textContent=`${Math.floor(j.progress)}%`;$('renderProgress').style.width=`${j.progress}%`;$('renderProgress').classList.toggle('bg-danger',failed);$('renderStatusText').textContent=j.status==='completed'?'Render complete':failed?'Render failed':j.status==='cancelled'?'Render cancelled':'Rendering…';$('renderTimeInfo').classList.toggle('text-danger',failed);$('renderTimeInfo').textContent=failed?(j.error||'Render gagal tanpa detail error.'):j.status==='cancelled'?'Render dibatalkan.':`${fmt(j.current_seconds)} / ${fmt(j.total_seconds)}${j.estimated_remaining_seconds!=null?` · ~${fmt(j.estimated_remaining_seconds)} remaining`:''}`;if(j.status==='completed'){ $('startRenderBtn').disabled=false;$('cancelRenderBtn').classList.add('d-none');$('renderOutputLink').href=j.output;$('renderOutputLink').classList.remove('d-none');state.project=sanitizeProject(await api(`${API}/projects/${state.project.id}`));state.dirty=false;renderRenderHistory();return;}if(terminal){ $('startRenderBtn').disabled=false;$('cancelRenderBtn').classList.add('d-none');if(j.error)toast(j.error,7000);return;}setTimeout(pollRender,800);}catch(e){toast(e.message);}}
  async function cancelRender(){if(!state.renderJob)return;await api(`${API}/render/${state.renderJob.id}/cancel`,{method:'POST'});toast('Render cancelled.');}

  function bindTextOverlay(){
    const layer=$('textOverlayLayer');let drag=null;
    const selectOverlayClip=overlay=>{const track=overlay.dataset.track,id=overlay.dataset.clipId;if(!track||!id)return;if(state.selected!==id||state.selectedTrack!==track){state.selectedTrack=track;state.selected=id;state.selectedClips=[selectedKey(track,id)];renderTimeline();renderInspector();}qsa('.subtitle-overlay',layer).forEach(item=>item.classList.toggle('is-selected',item===overlay));};
    layer.addEventListener('focusin',event=>{const content=event.target.closest('.subtitle-text-content'),overlay=content?.closest('.subtitle-overlay');if(overlay)selectOverlayClip(overlay);});
    layer.addEventListener('input',event=>{const content=event.target.closest('.subtitle-text-content'),overlay=content?.closest('.subtitle-overlay');if(!overlay)return;const clip=findClip(overlay.dataset.track,overlay.dataset.clipId);if(!clip)return;clip.text=content.innerText;clip.manual_override=true;if(state.selected===clip.id)$('insSubtitleText').value=clip.text;markDirty(false);});
    layer.addEventListener('focusout',event=>{const overlay=event.target.closest('.subtitle-overlay');if(!overlay)return;const clip=findClip(overlay.dataset.track,overlay.dataset.clipId);if(!clip)return;markDirty(true,'Edit text');renderTimeline();});
    layer.addEventListener('pointerdown',event=>{const handle=event.target.closest('.text-drag-handle'),overlay=handle?.closest('.subtitle-overlay');if(!handle||!overlay)return;const clip=findClip(overlay.dataset.track,overlay.dataset.clipId),stage=$('previewStage');if(!clip||!stage.clientWidth||!stage.clientHeight)return;event.preventDefault();event.stopPropagation();selectOverlayClip(overlay);drag={clip,overlay,handle,startX:event.clientX,startY:event.clientY,x:Number(clip.position_x||0),y:Number(clip.position_y||0)};handle.setPointerCapture(event.pointerId);});
    layer.addEventListener('pointermove',event=>{if(!drag)return;drag.clip.position_x=clamp(drag.x+(event.clientX-drag.startX)/$('previewStage').clientWidth*100,-50,50);drag.clip.position_y=clamp(drag.y+(event.clientY-drag.startY)/$('previewStage').clientHeight*100,-50,50);renderSubtitleOverlay(drag.clip,drag.overlay.dataset.track,drag.overlay);updateSubtitlePreviewScale();$('insTextPosX').value=Math.round(drag.clip.position_x);$('insTextPosY').value=Math.round(drag.clip.position_y);});
    layer.addEventListener('pointerup',event=>{if(!drag)return;drag.handle.releasePointerCapture(event.pointerId);drag.clip.manual_override=true;drag=null;markDirty(true,'Move text');renderTimeline();});
  }

  function bindEvents(){
    $('newProjectBtn').onclick=()=>createProject(`Project ${new Date().toLocaleString()}`); $('saveBtn').onclick=saveProject; $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
    $('projectName').addEventListener('change',()=>{state.project.name=$('projectName').value.trim()||'Untitled Project';markDirty(true,'Rename project');});
    $('autoSyncBtn').onclick=requestAutoSync;
    $('narrationLanguage').onchange=e=>{state.project.ui.narration_language=e.target.value;markDirty(false);toast(`Bahasa naskah: ${e.target.options[e.target.selectedIndex].text}.`);};
    $('syncNewVoiceBtn').onclick=()=>confirmAutoSync(false,'new');
    $('syncReplaceAllBtn').onclick=()=>confirmAutoSync(true,'all');
    $('coverageApplyBtn').onclick=applyCoverageDraft;
    $('aiSetupRetryBtn').onclick=()=>startAiSetup(true);
    $('aiSetupLimitedBtn').onclick=()=>{clearTimeout(aiSetupPollTimer);bootstrap.Modal.getOrCreateInstance($('aiSetupModal')).hide();const resolve=aiSetupResolve;aiSetupResolve=null;if(resolve)resolve(true);toast('Mode terbatas aktif: hasil memakai cache/fallback lokal.',5000);};
    $('autoCaptionBtn').onclick=(ev)=>runAutoCaption(ev.shiftKey);
    $('captionManagerBtn').onclick=()=>{renderCaptionManager();bootstrap.Modal.getOrCreateInstance($('captionManagerModal')).show();};
    $('captionSearch').oninput=renderCaptionManager;$('saveCaptionsBtn').onclick=saveManagedCaptions;$('importSrtBtn').onclick=()=>{$('srtInput').value='';$('srtInput').click();};$('srtInput').onchange=e=>importSrt(e.target.files[0]);$('exportSrtBtn').onclick=exportSrt;
    $('captionEnabledToggle').onchange=e=>toggleCaptions(e.target.checked);
    qsa('.caption-style-card').forEach(card=>card.onclick=()=>applyCaptionStyle(card.dataset.captionStyle,false));
    $('applyCaptionStyleAll').onclick=()=>applyCaptionStyle(state.project?.ui?.caption_style||'classic',true);
    $('uploadAssetBtn').onclick=uploadAssets;$('assetInput').onchange=e=>handleFiles(e.target.files);$('assetSearch').oninput=renderAssets;$('assetFolderFilter').onchange=renderAssets;$('assetUnusedOnly').onchange=renderAssets;
    $('assetGrid').ondragover=e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();$('assetGrid').classList.add('is-file-drop');}};$('assetGrid').ondragleave=()=>$('assetGrid').classList.remove('is-file-drop');$('assetGrid').ondrop=e=>{if(!e.dataTransfer?.files?.length)return;e.preventDefault();e.stopPropagation();$('assetGrid').classList.remove('is-file-drop');handleFiles(e.dataTransfer.files);};
    $('saveAssetOrganizerBtn').onclick=saveAssetOrganizer;$('duplicateAssetBtn').onclick=duplicateAsset;
    $('saveImageMetadataBtn').onclick=saveImageMetadata;
    $('reanalyzeImageBtn').onclick=reanalyzeImage;
    $('saveVideoMetadataBtn').onclick=saveVideoMetadata;$('reanalyzeVideoBtn').onclick=reanalyzeVideo;$('videoAddShotBtn').onclick=addManualVideoShot;$('videoDeleteShotBtn').onclick=deleteVideoShot;$('videoUseShotBtn').onclick=useSelectedVideoShot;
    $('videoSetInBtn').onclick=()=>{$('videoShotIn').value=Math.max(0,$('videoPreviewLarge').currentTime||0).toFixed(2);};$('videoSetOutBtn').onclick=()=>{$('videoShotOut').value=Math.max(0,$('videoPreviewLarge').currentTime||0).toFixed(2);};
    $('videoPreviewLarge').addEventListener('timeupdate',()=>{const shot=currentVideoShot();if(shot&&$('videoPreviewLarge').currentTime>=Number(shot.source_end)-.03)$('videoPreviewLarge').pause();});
    $('reviewLowBtn').onclick=reviewNextLow;
    $('storyboardBtn').onclick=openStoryboard;
    $('storyboardLowOnly').onchange=renderStoryboard;
    $('syncChoiceMode').onchange=renderSyncModeExplanation;
    $('storyboardScriptVoice').onchange=loadStoryboardScript;
    $('storyboardScript').oninput=()=>{const id=$('storyboardScriptVoice').value;if(!id)return;state.project.ui.storyboard_scripts||={};state.project.ui.storyboard_scripts[id]=$('storyboardScript').value;state.project.ui.storyboard_stale=true;markDirty(false);};
    $('alignmentMode').onchange=()=>{state.project.ui.alignment_mode=$('alignmentMode').value;markDirty(true,'Change alignment mode');renderAutoSceneControl();};
    qsa('.asset-filter').forEach(b=>b.onclick=()=>{qsa('.asset-filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.assetKind=b.dataset.kind;renderAssets();});
    $('canvasResolution').onchange=e=>setCanvasResolution(e.target.value,true);$('renderResolution').onchange=e=>setCanvasResolution(e.target.value,true);
    $('playPauseBtn').onclick=()=>{stopVoicePreview();togglePlay();};$('prevSceneBtn').onclick=()=>nextScene(-1);$('nextSceneBtn').onclick=()=>nextScene(1);$('prevFrameBtn').onclick=()=>stepFrame(-1);$('nextFrameBtn').onclick=()=>stepFrame(1);$('playbackSpeed').onchange=applyPlaybackRate;$('loopInBtn').onclick=()=>setLoopPoint('in');$('loopOutBtn').onclick=()=>setLoopPoint('out');$('loopToggleBtn').onclick=toggleLoop;$('addMarkerBtn').onclick=addMarker;$('masterVolume').oninput=()=>applyPreviewAudioLevels();$('fullscreenBtn').onclick=()=>$('previewCanvasWrap').requestFullscreen?.();
    $('masterAudio').onended=advanceNarration; $('masterAudio').onseeked=()=>{const clip=narrationAt(state.playhead);if(clip)updatePreview(clip.start+$('masterAudio').currentTime);};
    $('ruler').onclick=e=>{const r=$('ruler').getBoundingClientRect();seekTo((e.clientX-r.left)/state.pixelsPerSecond);};
    $('zoomSlider').oninput=e=>setZoom(Number(e.target.value));$('zoomInBtn').onclick=()=>setZoom(state.zoomPct+25);$('zoomOutBtn').onclick=()=>setZoom(state.zoomPct-25);$('fitTimelineBtn').onclick=fitTimeline;
    $('replaceBtn').onclick=replaceSelected;$('duplicateBtn').onclick=duplicateSelected;$('splitBtn').onclick=splitAtPlayhead;$('splitToolbarBtn').onclick=splitAtPlayhead;$('deleteBtn').onclick=deleteSelected;
    $('renderBtn').onclick=()=>{$('renderFps').value=String(state.project.timeline.settings.fps||30);$('renderEncoder').value=state.project.timeline.settings.encoder||'h264';const quality=state.project.timeline.settings.quality||'standard';$('renderQuality').value=quality.charAt(0).toUpperCase()+quality.slice(1);renderRenderHistory();new bootstrap.Modal($('renderModal')).show();};$('startRenderBtn').onclick=startRender;$('cancelRenderBtn').onclick=cancelRender;
    $('addMusicBtn').onclick=()=>{state.assetKind='music';qsa('.asset-filter').forEach(x=>x.classList.toggle('active',x.dataset.kind==='music'));renderAssets();toast('Upload or double-click a music asset.');};
    $('copyClipsBtn').onclick=copySelected;$('pasteClipsBtn').onclick=pasteClips;
    qsa('[data-add-track]').forEach(button=>button.onclick=()=>addTrack(button.dataset.addTrack));
    $('addTextBtn').onclick=addTextOverlay;
    bindTextOverlay();
    bindInspector();
    qsa('#contextMenu button').forEach(b=>b.onclick=()=>{const a=b.dataset.action;({split:splitAtPlayhead,duplicate:duplicateSelected,replace:replaceSelected,lock:toggleLock,resetMotion,resetTransition,delete:deleteSelected}[a]||(()=>{}))();hideContextMenu();});
    document.addEventListener('click',e=>{if(!$('contextMenu').contains(e.target))hideContextMenu();});
    window.addEventListener('resize',fitPreviewCanvas);document.addEventListener('fullscreenchange',()=>requestAnimationFrame(fitPreviewCanvas));
    if(window.ResizeObserver)new ResizeObserver(()=>fitPreviewCanvas()).observe($('previewCanvasWrap'));
    document.addEventListener('keydown',e=>{
      const tag=(e.target.tagName||'').toLowerCase(),typing=['input','textarea','select'].includes(tag)||e.target.isContentEditable,saveShortcut=(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s';if(typing&&!saveShortcut)return;
      if(e.code==='Space'){e.preventDefault();togglePlay();} else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undo();} else if(((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y')||((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='z')){e.preventDefault();redo();} else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();copySelected();} else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();pasteClips();} else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject();} else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();} else if(e.key.toLowerCase()==='s'&&!typing){e.preventDefault();splitAtPlayhead();} else if(e.key.toLowerCase()==='j'){e.preventDefault();stopPreviewPlayback();startSilentPlayback(state.playhead,-1);} else if(e.key.toLowerCase()==='k'){e.preventDefault();stopPreviewPlayback();} else if(e.key.toLowerCase()==='l'){e.preventDefault();if(state.silentPlayback?.direction===-1)stopPreviewPlayback();if(!isPreviewPlaying())togglePlay();} else if(e.key.toLowerCase()==='i'){e.preventDefault();setLoopPoint('in');} else if(e.key.toLowerCase()==='o'){e.preventDefault();setLoopPoint('out');} else if(e.key.toLowerCase()==='m'){e.preventDefault();addMarker();} else if(['Delete','Backspace'].includes(e.key)&&!typing){e.preventDefault();deleteSelected();} else if(e.key==='ArrowLeft'){e.preventDefault();seekTo(state.playhead-(e.shiftKey?5:.25));} else if(e.key==='ArrowRight'){e.preventDefault();seekTo(state.playhead+(e.shiftKey?5:.25));}
    });
    window.addEventListener('pagehide',saveProjectBeforeExit);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveProjectBeforeExit();});
  }

  populateCanvasControls(); bindEvents(); bootstrapApp();
})();
