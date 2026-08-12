'use strict';

/* ============================ 常量与状态 ============================ */
const $ = (id) => document.getElementById(id);

const state = {
  tab: 'design',
  config: { api_key: '', base_url: '' },
  sample: null,          // { b64, mime, name, size }
  promptDirty: false,    // 用户手工改过描述预览后，不再自动覆盖
};

const GENDER = {
  female: { zh: '女性', en: 'female' },
  male: { zh: '男性', en: 'male' },
  any: { zh: '', en: '' },
};

const AGE = {
  any: { zh: '', en: '' },
  child: { zh: '儿童', en: 'child' },
  teen: { zh: '少年', en: 'teenage' },
  '20s': { zh: '二十多岁', en: 'mid-20s' },
  '30s': { zh: '三十多岁', en: 'mid-30s' },
  '40s': { zh: '四十多岁', en: 'mid-40s' },
  '50s': { zh: '五十多岁', en: 'mid-50s' },
  '60s': { zh: '六十多岁', en: 'mid-60s' },
  elder: { zh: '老年', en: 'senior' },
};

const TIMBRES = [
  { id: 'bright', zh: '清亮', en: 'bright and clear' },
  { id: 'magnetic', zh: '磁性', en: 'magnetic' },
  { id: 'mellow', zh: '醇厚', en: 'mellow and rich' },
  { id: 'gravelly', zh: '沙哑', en: 'gravelly' },
  { id: 'sweet', zh: '甜美', en: 'sweet' },
  { id: 'ethereal', zh: '空灵', en: 'ethereal' },
  { id: 'youthful', zh: '稚嫩', en: 'youthful' },
  { id: 'aged', zh: '苍老', en: 'aged' },
  { id: 'refined', zh: '醇雅', en: 'refined' },
  { id: 'deep', zh: '低沉', en: 'deep' },
  { id: 'rounded', zh: '圆润', en: 'rounded' },
  { id: 'crisp', zh: '明亮', en: 'crisp and bright' },
];

const MOODS = [
  { id: 'gentle', zh: '温柔', en: 'gentle' },
  { id: 'aloof', zh: '高冷', en: 'aloof' },
  { id: 'lively', zh: '活泼', en: 'lively' },
  { id: 'languid', zh: '慵懒', en: 'languid' },
  { id: 'playful', zh: '俏皮', en: 'playful' },
  { id: 'profound', zh: '深沉', en: 'deep and profound' },
  { id: 'capable', zh: '干练', en: 'crisp and capable' },
  { id: 'sharp', zh: '凌厉', en: 'sharp and edgy' },
  { id: 'serious', zh: '严肃', en: 'serious' },
  { id: 'cheerful', zh: '开心', en: 'cheerful' },
  { id: 'melancholic', zh: '悲伤', en: 'melancholic' },
  { id: 'calm', zh: '平静', en: 'calm' },
  { id: 'weary', zh: '疲惫', en: 'weary' },
  { id: 'excited', zh: '兴奋', en: 'excited' },
];

const SPEED = {
  any: { zh: '', en: '' },
  verySlow: { zh: '极慢', en: 'extremely slow' },
  slow: { zh: '缓慢', en: 'slow and deliberate' },
  normal: { zh: '正常', en: 'normal' },
  fast: { zh: '较快', en: 'fast' },
  veryFast: { zh: '极快，像连珠炮', en: 'very fast, like rapid fire' },
};

const ROLES = {
  any: { zh: '', en: '' },
  narrator: { zh: '旁白', en: 'a narrator' },
  radioDj: { zh: '深夜电台 DJ', en: 'a late-night radio DJ' },
  storyteller: { zh: '评书先生', en: 'a traditional storyteller' },
  podcast: { zh: '播客主持', en: 'a podcast host' },
  audiobook: { zh: '有声书主播', en: 'an audiobook narrator' },
  documentary: { zh: '纪录片解说', en: 'a documentary narrator' },
  gameVoice: { zh: '游戏角色配音', en: 'a game character voice actor' },
  customerService: { zh: '客服', en: 'a customer service agent' },
  teacher: { zh: '老师', en: 'a teacher' },
  sales: { zh: '推销员', en: 'a salesperson' },
};

const STYLE_TAGS = ['开心', '悲伤', '慵懒', '磁性', '甜美', '温柔', '高冷', '俏皮', '东北话', '粤语', '唱歌', '御姐音', '大叔音', '夹子音'];
const INLINE_TAGS = ['轻笑', '哽咽', '深呼吸', '叹气', '语速加快', '语速放慢', '小声', '提高音量', '停顿', '颤抖', '气声', '咳嗽', '大笑', '抽泣'];

const TEMPLATES = [
  {
    name: 'ASMR 助眠',
    fields: {
      descGender: 'female', descAge: '20s', descSpeed: 'verySlow', descRole: 'any',
      descScene: '在安静的深夜，用贴近耳朵的低声细语录制助眠内容，营造沉浸放松的氛围',
      descEra: '', descStyle: '刻意放慢语速，带有轻微的呼吸声和自然的唇齿音，轻柔、不打扰',
    },
    timbre: ['bright', 'ethereal'],
    mood: ['gentle', 'calm'],
  },
  {
    name: '老爷爷讲故事',
    fields: {
      descGender: 'male', descAge: 'elder', descSpeed: 'slow', descRole: 'storyteller',
      descScene: '冬夜炉火旁，给围坐的孙辈讲一个遥远年代的故事',
      descEra: '', descStyle: '带北方口音的普通话，语速沉稳，嗓音略带沙哑和沧桑感，充满岁月的智慧',
    },
    timbre: ['gravelly', 'mellow'],
    mood: ['gentle', 'profound'],
  },
  {
    name: '深夜电台 DJ',
    fields: {
      descGender: 'male', descAge: '30s', descSpeed: 'slow', descRole: 'radioDj',
      descScene: '午夜十二点的直播，独自一人在直播间对着话筒，城市已经入睡',
      descEra: '', descStyle: '压低嗓音，气声自然，一字一句都带着安抚感',
    },
    timbre: ['magnetic', 'deep'],
    mood: ['languid', 'profound'],
  },
  {
    name: '纪录片解说',
    fields: {
      descGender: 'male', descAge: '40s', descSpeed: 'normal', descRole: 'documentary',
      descScene: '自然纪录片的画外旁白，镜头掠过广袤的原野与河流',
      descEra: '', descStyle: '沉稳克制，吐字清晰，庄重而不煽情',
    },
    timbre: ['mellow', 'rounded'],
    mood: ['calm', 'serious'],
  },
  {
    name: '元气游戏少女',
    fields: {
      descGender: 'female', descAge: 'teen', descSpeed: 'fast', descRole: 'gameVoice',
      descScene: '和伙伴组队闯关的副本里，一边战斗一边兴奋地喊出技能',
      descEra: '', descStyle: '元气满满，尾音上扬，带着恶作剧得逞的小得意',
    },
    timbre: ['bright', 'sweet'],
    mood: ['lively', 'playful'],
  },
];

/* ============================ 初始化 ============================ */
document.addEventListener('DOMContentLoaded', init);

function init() {
  buildChipGroup('descTimbre', TIMBRES);
  buildChipGroup('descMood', MOODS);
  buildTagBars();
  buildTemplates();
  wireTabs();
  wireForm();
  wireGenerate();
  wireUpload();
  wireSettings();
  regeneratePrompt(true);
  loadConfig();
}

/* ============================ 音色描述生成 ============================ */
function buildVoiceDescription() {
  const lang = $('descLang').value;
  const g = $('descGender').value;
  const a = $('descAge').value;
  const speed = $('descSpeed').value;
  const role = $('descRole').value;
  const scene = $('descScene').value.trim();
  const era = $('descEra').value.trim();
  const style = $('descStyle').value.trim();
  const timbreIds = [...document.querySelectorAll('#descTimbre .chip.on')].map((c) => c.dataset.id);
  const moodIds = [...document.querySelectorAll('#descMood .chip.on')].map((c) => c.dataset.id);

  const zhOf = (list, id) => (list.find((x) => x.id === id) || {}).zh || '';
  const enOf = (list, id) => (list.find((x) => x.id === id) || {}).en || '';

  if (lang === 'en') {
    const tEn = timbreIds.map((id) => enOf(TIMBRES, id)).filter(Boolean);
    const mEn = moodIds.map((id) => enOf(MOODS, id)).filter(Boolean);
    const ageEn = AGE[a].en;
    const genEn = GENDER[g].en;
    let head = '';
    if (ageEn && genEn) head = `a ${ageEn} ${genEn}`;
    else if (ageEn) head = `a ${ageEn} person`;
    else if (genEn) head = `a ${genEn}`;
    const bits = [];
    if (tEn.length) bits.push(`${tEn.join(', ')} voice`);
    if (mEn.length) bits.push(`${mEn.join(', ')} tone`);
    const parts = [];
    if (head && bits.length) parts.push(`${head[0].toUpperCase()}${head.slice(1)} with a ${bits.join(', ')}.`);
    else if (head) parts.push(`${head[0].toUpperCase()}${head.slice(1)}.`);
    else if (bits.length) parts.push(`The voice has a ${bits.join(', ')}.`);
    const spdEn = SPEED[speed].en;
    if (spdEn) parts.push(`Speaking pace: ${spdEn}.`);
    const roleEn = ROLES[role].en;
    if (roleEn) parts.push(`Persona: ${roleEn}.`);
    const extras = [];
    if (scene) extras.push(`Context: ${scene}`);
    if (era) extras.push(`Era/style reference: ${era}`);
    if (style) extras.push(`Speaking style: ${style}`);
    if (extras.length) parts.push(extras.join('; ') + '.');
    return parts.join(' ');
  }

  // 中文
  const genZh = GENDER[g].zh;
  const ageZh = AGE[a].zh;
  let head = '';
  if (genZh && ageZh) {
    const noDe = ['儿童', '少年', '老年'].includes(ageZh);
    head = `一位${ageZh}${noDe ? '' : '的'}${genZh}`;
  } else if (genZh) head = `一位${genZh}`;
  else if (ageZh) head = `一位${ageZh}的说话者`;

  const sentences = [];
  let s1 = '';
  if (head) s1 += head;
  const tZh = timbreIds.map((id) => zhOf(TIMBRES, id)).filter(Boolean);
  if (tZh.length) s1 += `${s1 ? '，' : ''}音色${tZh.join('、')}`;
  const mZh = moodIds.map((id) => zhOf(MOODS, id)).filter(Boolean);
  if (mZh.length) s1 += `${s1 ? '，' : ''}语气${mZh.join('、')}`;
  if (s1) sentences.push(`${s1}。`);

  let s2 = '';
  const spdZh = SPEED[speed].zh;
  if (spdZh) s2 += `语速${spdZh}`;
  const roleZh = ROLES[role].zh;
  if (roleZh) s2 += `${s2 ? '，' : ''}人设是${roleZh}`;
  if (s2) sentences.push(`${s2}。`);

  const extras = [];
  if (scene) extras.push(`场景：${scene}`);
  if (era) extras.push(`年代/风格参照：${era}`);
  if (style) extras.push(`说话风格：${style}`);
  if (extras.length) sentences.push(`${extras.join('；')}。`);

  return sentences.join('');
}

function regeneratePrompt(force = false) {
  if (state.promptDirty && !force) return;
  $('designPrompt').value = buildVoiceDescription();
  state.promptDirty = false;
  updatePromptCount();
}

function updatePromptCount() {
  const v = $('designPrompt').value;
  const sentences = v.split(/[。！？.!?\n]/).filter((s) => s.trim()).length;
  const el = $('designPromptCount');
  el.textContent = `${v.length} 字 · ${sentences} 句（建议 1–4 句）`;
  el.classList.toggle('warn', sentences > 4 || v.length > 400);
}

/* ============================ 工单与预览联动 ============================ */
function wireForm() {
  const form = $('designForm');
  const onChanged = () => { if (!state.promptDirty) regeneratePrompt(); };
  form.addEventListener('input', (e) => {
    if (e.target.id !== 'designPrompt') onChanged();
  });
  form.addEventListener('change', () => onChanged());
  $('btnRegenPrompt').addEventListener('click', () => regeneratePrompt(true));

  $('designPrompt').addEventListener('input', () => {
    state.promptDirty = true;
    updatePromptCount();
  });
}

function buildChipGroup(id, items) {
  const box = $(id);
  box.innerHTML = '';
  items.forEach((it) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = it.zh;
    btn.dataset.id = it.id;
    btn.addEventListener('click', () => {
      btn.classList.toggle('on');
      if (!state.promptDirty) regeneratePrompt();
    });
    box.appendChild(btn);
  });
}

function buildTemplates() {
  const box = $('templateList');
  TEMPLATES.forEach((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip template';
    btn.textContent = t.name;
    btn.addEventListener('click', () => applyTemplate(t));
    box.appendChild(btn);
  });
}

function applyTemplate(t) {
  document.querySelectorAll('#descTimbre .chip, #descMood .chip').forEach((c) => c.classList.remove('on'));
  Object.entries(t.fields).forEach(([id, val]) => { if ($(id)) $(id).value = val; });
  (t.timbre || []).forEach((id) => {
    const b = document.querySelector(`#descTimbre .chip[data-id="${id}"]`);
    if (b) b.classList.add('on');
  });
  (t.mood || []).forEach((id) => {
    const b = document.querySelector(`#descMood .chip[data-id="${id}"]`);
    if (b) b.classList.add('on');
  });
  state.promptDirty = false;
  regeneratePrompt(true);
}

/* ============================ 风格 / 音频标签 ============================ */
function buildTagBars() {
  ['designText', 'cloneText'].forEach((targetId) => {
    const bar = document.querySelector(`[data-tagbar="${targetId}"]`);
    if (!bar) return;
    bar.innerHTML = '';

    const gStyle = document.createElement('div');
    gStyle.className = 'taggroup';
    gStyle.innerHTML = '<span class="taglabel">整体风格 (…)</span>';
    STYLE_TAGS.forEach((tag) => gStyle.appendChild(makeTagBtn(tag, 'style', targetId)));

    const gInline = document.createElement('div');
    gInline.className = 'taggroup';
    gInline.innerHTML = '<span class="taglabel">内联音频 [ … ]</span>';
    INLINE_TAGS.forEach((tag) => gInline.appendChild(makeTagBtn(tag, 'inline', targetId)));

    bar.append(gStyle, gInline);
  });
}

function makeTagBtn(tag, kind, targetId) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tagbtn';
  btn.textContent = kind === 'style' ? `(${tag})` : `[${tag}]`;
  btn.title = kind === 'style' ? '插入整体风格标签（置于文本开头，可叠加多个）' : '在光标处插入音频标签';
  btn.addEventListener('click', () => {
    const ta = $(targetId);
    if (kind === 'style') insertStyleTag(ta, tag);
    else insertInlineTag(ta, tag);
    ta.focus();
  });
  return btn;
}

function insertStyleTag(ta, tag) {
  const text = ta.value;
  const m = text.match(/^\s*[\(\（][^\)）]*[\)）]/);
  if (m) {
    const inner = m[0].replace(/[\(\（\)）]/g, '');
    const tags = inner.split(/[\s,，、;；]+/).filter(Boolean);
    if (!tags.includes(tag)) tags.push(tag);
    ta.value = text.slice(0, m.index) + `(${tags.join(' ')})` + text.slice(m.index + m[0].length);
  } else {
    ta.value = `(${tag})${text}`;
  }
}

function insertInlineTag(ta, tag) {
  const start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
  const end = ta.selectionEnd == null ? ta.value.length : ta.selectionEnd;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const leftPad = before && !before.endsWith(' ') && !before.endsWith('[') ? ' ' : '';
  const rightPad = after && !after.startsWith(' ') && !after.startsWith(']') ? ' ' : '';
  ta.value = before + leftPad + `[${tag}]` + rightPad + after;
  const cursor = start + leftPad.length + tag.length + 2;
  ta.setSelectionRange(cursor, cursor);
}

/* ============================ Tab 切换 ============================ */
function wireTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${state.tab}`));
    });
  });
}

/* ============================ 生成语音 ============================ */
function wireGenerate() {
  $('btnDesignGo').addEventListener('click', () => runGenerate('design'));
  $('btnCloneGo').addEventListener('click', () => runGenerate('clone'));
}

function runGenerate(tab) {
  clearError(tab);
  if (!(state.config.api_key || '').trim()) {
    showError(tab, '请先配置 API Key');
    openSettings();
    return;
  }

  const body = tab === 'design' ? buildDesignBody() : buildCloneBody();
  if (!body) return;

  const btn = tab === 'design' ? $('btnDesignGo') : $('btnCloneGo');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '生成中…';

  fetch(`/api/tts/${tab}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `请求失败（HTTP ${res.status}）`);
      renderResult(tab, data);
    })
    .catch((err) => showError(tab, err.message || String(err)))
    .finally(() => {
      btn.disabled = false;
      btn.textContent = original;
    });
}

function buildDesignBody() {
  const prompt = $('designPrompt').value.trim();
  if (!prompt) {
    showError('design', '请填写音色描述（可先用模板或左侧工单生成）');
    return null;
  }
  return {
    prompt,
    text: $('designText').value.trim(),
    style_tags: $('designStyleTags').value.trim(),
    optimize_preview: $('designOptimize').checked,
  };
}

function buildCloneBody() {
  if (!state.sample) {
    showError('clone', '请先上传音频样本');
    return null;
  }
  const text = $('cloneText').value.trim();
  if (!text) {
    showError('clone', '合成文本不能为空');
    return null;
  }
  return {
    sample_b64: state.sample.b64,
    mime: state.sample.mime,
    text,
    style_tags: $('cloneStyleTags').value.trim(),
    instruction: $('cloneInstruction').value.trim(),
  };
}

function renderResult(tab, data) {
  const box = tab === 'design' ? $('designResult') : $('cloneResult');
  const audioUrl = `data:audio/wav;base64,${data.audio_b64}`;
  const secs = data.elapsed_ms != null ? ` · ${(data.elapsed_ms / 1000).toFixed(1)}s` : '';
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  box.innerHTML = `
    <audio controls preload="auto" src="${audioUrl}"></audio>
    <div class="result-foot">
      <a class="btn-ink sm" download="mimo-tts-${stamp}.wav" href="${audioUrl}">下载 WAV</a>
      <span class="meta">${data.model || ''}${secs}</span>
    </div>`;
  box.classList.add('visible');
  const top = box.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
}

/* ============================ 样本上传 ============================ */
function wireUpload() {
  const zone = $('dropZone');
  const input = $('fileInput');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleSampleFile(file);
  });
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) handleSampleFile(input.files[0]);
    input.value = '';
  });
  $('btnClearSample').addEventListener('click', () => {
    state.sample = null;
    $('sampleInfo').classList.add('hidden');
    $('dropZone').classList.remove('hidden');
  });
}

function handleSampleFile(file) {
  clearError('clone');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['mp3', 'wav'].includes(ext)) {
    showError('clone', '仅支持 mp3 / wav 格式的音频样本');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('clone', '样本文件超过 10MB（Base64 后需 ≤ 10MB，建议原文件 ≤ 7.5MB）');
    return;
  }

  const mime = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';
  const reader = new FileReader();
  reader.onload = () => {
    const b64 = String(reader.result).split(',')[1] || '';
    if (b64.length > 10 * 1024 * 1024) {
      showError('clone', '样本经 Base64 编码后超过 10MB，请换用更短的音频');
      return;
    }
    state.sample = { b64, mime, name: file.name, size: file.size };
    renderSample();
  };
  reader.readAsDataURL(file);
}

function renderSample() {
  const s = state.sample;
  $('dropZone').classList.add('hidden');
  $('sampleInfo').classList.remove('hidden');
  $('samplePlayer').src = `data:${s.mime};base64,${s.b64}`;
  $('sampleName').textContent = `${s.name}（${(s.size / 1024 / 1024).toFixed(2)} MB）`;
}

/* ============================ 设置 ============================ */
function wireSettings() {
  $('btnSettings').addEventListener('click', openSettings);
  $('keyStatus').addEventListener('click', () => { if (!state.config.api_key) openSettings(); });
  $('keyStatus').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !state.config.api_key) openSettings();
  });
  $('btnCloseSettings').addEventListener('click', closeSettings);
  $('btnSaveConfig').addEventListener('click', saveConfig);
  $('btnToggleKey').addEventListener('click', () => {
    const inp = $('cfgApiKey');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  $('settingsModal').addEventListener('click', (e) => {
    if (e.target === $('settingsModal')) closeSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('settingsModal').classList.contains('hidden')) closeSettings();
  });
}

function openSettings() {
  $('cfgApiKey').value = state.config.api_key || '';
  $('cfgBaseUrl').value = state.config.base_url || '';
  $('cfgMsg').textContent = '';
  $('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  $('settingsModal').classList.add('hidden');
}

async function saveConfig() {
  const api_key = $('cfgApiKey').value.trim();
  const base_url = $('cfgBaseUrl').value.trim();
  $('cfgMsg').textContent = '';
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key, base_url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `保存失败（HTTP ${res.status}）`);
    state.config = { api_key, base_url };
    updateKeyStatus();
    toast('API 设置已保存');
    closeSettings();
  } catch (err) {
    $('cfgMsg').textContent = err.message;
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      state.config = { api_key: data.api_key || '', base_url: data.base_url || '' };
      updateKeyStatus();
    }
  } catch (e) { /* 服务未就绪时忽略 */ }
}

function updateKeyStatus() {
  const el = $('keyStatus');
  const has = !!(state.config.api_key || '').trim();
  $('keyStatusText').textContent = has ? 'API KEY 已配置' : 'API KEY 未配置';
  el.classList.toggle('ok', has);
}

/* ============================ 通用 ============================ */
function showError(tab, msg) {
  const el = $(`${tab}Error`);
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
  }
}

function clearError(tab) {
  const el = $(`${tab}Error`);
  if (el) {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

function toast(msg) {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}
