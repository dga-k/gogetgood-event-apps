'use strict';
const $ = id => document.getElementById(id);
let codes = [], busy = false, fields = [], submissions = [], winners = [];
let existing = new Set();
const say = text => { $('status').textContent = text; };
function check(result) { if (result.error) throw result.error; return result; }
function currentEvent() { return $('event').value.trim(); }
function safeFileName(value) { return value.replace(/[^a-zA-Z0-9ก-๙_-]/g,'_'); }
function buttons() {
  $('save').disabled = busy || !codes.length || !currentEvent() || currentEvent().length > 120;
  $('download').disabled = $('save').disabled;
  $('save-fields').disabled = busy || !currentEvent() || !existing.has(currentEvent());
  $('refresh-submissions').disabled = busy || !currentEvent() || !existing.has(currentEvent());
  $('refresh-winners').disabled = busy || !currentEvent() || !existing.has(currentEvent());
  $('export-submissions').disabled = !submissions.length;
  $('reset-winners').disabled = busy || !currentEvent() || !existing.has(currentEvent());
}
function lock(value) {
  busy = value;
  for (const id of ['event','excel','saved-events','read']) $(id).disabled = value;
  document.querySelectorAll('.delete-submission,.delete-winner').forEach(button => { button.disabled = value; });
  buttons();
}
function preview() {
  $('json').value = codes.length ? JSON.stringify({event:currentEvent(),codes:codes.slice(0,20)},null,2) : '';
  $('register-link').replaceChildren();
  buttons();
}
function link() {
  const url = new URL('coupon_register.html',location.href); url.searchParams.set('event',currentEvent());
  const a = document.createElement('a'); a.href = url.href; a.textContent = url.href; a.target = '_blank'; a.rel = 'noopener';
  const drawUrl = new URL('coupon_draw.html',location.href); drawUrl.searchParams.set('event',currentEvent());
  const drawLink = document.createElement('a'); drawLink.href = drawUrl.href; drawLink.textContent = drawUrl.href; drawLink.target = '_blank'; drawLink.rel = 'noopener';
  $('register-link').replaceChildren('หน้าลงทะเบียนคูปอง: ',a,document.createElement('br'),'หน้าประกาศผล: ',drawLink);
}
function renderFields() {
  const container = $('fields');
  container.replaceChildren();
  fields.forEach((field, index) => {
    const row = document.createElement('div');
    row.className = 'field-row';
    const labelWrap = document.createElement('label');
    labelWrap.textContent = 'ชื่อฟิลด์';
    const labelInput = document.createElement('input');
    labelInput.value = field.label || '';
    labelInput.maxLength = 100;
    labelInput.placeholder = 'เช่น ชื่อ-นามสกุล';
    labelInput.addEventListener('input', () => { field.label = labelInput.value; });
    labelWrap.append(labelInput);

    const typeWrap = document.createElement('label');
    typeWrap.textContent = 'ประเภท';
    const typeSelect = document.createElement('select');
    typeSelect.add(new Option('ข้อความ','text'));
    typeSelect.add(new Option('Dropdown','select'));
    typeSelect.value = field.type === 'select' ? 'select' : 'text';
    typeSelect.addEventListener('change', () => { field.type = typeSelect.value; renderFields(); });
    typeWrap.append(typeSelect);

    const optionsWrap = document.createElement('label');
    optionsWrap.className = 'options-label';
    optionsWrap.textContent = field.type === 'select' ? 'ตัวเลือก (คั่นด้วย ,)' : 'ตัวเลือก';
    const optionsInput = document.createElement('input');
    optionsInput.disabled = field.type !== 'select';
    optionsInput.value = (field.options || []).join(', ');
    optionsInput.placeholder = 'เช่น สาขาสยาม, สาขาอโศก';
    optionsInput.addEventListener('input', () => { field.options = optionsInput.value.split(',').map(value => value.trim()).filter(Boolean); });
    optionsWrap.append(optionsInput);

    const controls = document.createElement('div');
    const requiredLabel = document.createElement('label');
    requiredLabel.className = 'required-toggle';
    const requiredInput = document.createElement('input');
    requiredInput.type = 'checkbox';
    requiredInput.checked = Boolean(field.required);
    requiredInput.addEventListener('change', () => { field.required = requiredInput.checked; });
    requiredLabel.append(requiredInput, document.createTextNode('จำเป็น'));
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'ลบฟิลด์';
    removeButton.addEventListener('click', () => { fields.splice(index, 1); renderFields(); });
    controls.append(requiredLabel, removeButton);
    row.append(labelWrap, typeWrap, optionsWrap, controls);
    container.append(row);
  });
  $('fields-hint').textContent = existing.has(currentEvent()) ? 'แก้ไขฟิลด์แล้วกดบันทึกเพื่ออัปเดตลิงก์งานนี้' : 'บันทึกชุดรหัสของงานก่อน จึงจะบันทึกฟิลด์ได้';
  buttons();
}
function csvCell(value) { return `"${String(value ?? '').replaceAll('"','""')}"`; }
function submissionFieldLabels() {
  return [...new Set([...fields.map(field => field.label),...submissions.flatMap(row => Object.keys(row.details || {}))])];
}
function renderSubmissions() {
  const head = $('submission-head'), body = $('submission-body');
  head.replaceChildren(); body.replaceChildren();
  const fieldLabels = submissionFieldLabels();
  const columns = ['ลงทะเบียนเมื่อ','รหัสคูปอง',...fieldLabels,'จัดการ'];
  const headerRow = document.createElement('tr');
  columns.forEach(label => { const th = document.createElement('th'); th.textContent = label; headerRow.append(th); });
  head.append(headerRow);
  submissions.forEach(row => {
    const tr = document.createElement('tr');
    const values = [new Date(row.created_at).toLocaleString('th-TH'),row.coupon_code,...fieldLabels.map(label => row.details?.[label] || '')];
    values.forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); });
    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'ลบ';
    deleteButton.className = 'delete-submission';
    deleteButton.disabled = busy;
    deleteButton.addEventListener('click',() => deleteSubmission(row.coupon_code));
    actionCell.append(deleteButton);
    tr.append(actionCell);
    body.append(tr);
  });
  $('submission-summary').textContent = `พบ ${submissions.length.toLocaleString()} รายการ`;
  buttons();
}
function renderWinners() {
  const head = $('winner-head'), body = $('winner-body');
  head.replaceChildren(); body.replaceChildren();
  const headerRow = document.createElement('tr');
  ['ประกาศเมื่อ','รหัสคูปอง','ชื่อผู้ได้รางวัล','จัดการ'].forEach(label => {
    const th = document.createElement('th'); th.textContent = label; headerRow.append(th);
  });
  head.append(headerRow);
  winners.forEach(winner => {
    const tr = document.createElement('tr');
    [new Date(winner.created_at).toLocaleString('th-TH'),winner.coupon_code,winner.display_name].forEach(value => {
      const td = document.createElement('td'); td.textContent = value || '-'; tr.append(td);
    });
    const actionCell = document.createElement('td');
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'ลบ';
    deleteButton.className = 'delete-winner';
    deleteButton.disabled = busy;
    deleteButton.addEventListener('click',() => deleteWinner(winner.coupon_code));
    actionCell.append(deleteButton); tr.append(actionCell); body.append(tr);
  });
  $('winner-summary').textContent = `พบผู้ได้รางวัล ${winners.length.toLocaleString()} คน`;
  buttons();
}
async function loadSubmissions() {
  if (!existing.has(currentEvent())) return;
  const {data} = check(await _supabase.from('coupon_submissions').select('created_at,coupon_code,details').eq('event',currentEvent()).order('created_at',{ascending:false}));
  submissions = data || [];
  renderSubmissions();
}
async function loadWinners() {
  if (!existing.has(currentEvent())) return;
  const {data} = check(await _supabase.rpc('coupon_draw_history',{p_event:currentEvent()}));
  winners = data || [];
  renderWinners();
}
async function deleteWinner(couponCode) {
  const event = currentEvent();
  if (busy || !existing.has(event)) return;
  if (!confirm(`ยืนยันลบผู้ได้รางวัลรหัส ${couponCode} ของงาน “${event}” ?\nรหัสนี้จะกลับมาอยู่ใน pool จับรางวัล`)) return;
  lock(true);
  try {
    const {data,error} = await _supabase.rpc('coupon_draw_remove_winner',{p_event:event,p_coupon_code:couponCode});
    if (error) throw error;
    if (Number(data) < 1) throw new Error('ไม่พบประวัติผู้ได้รางวัลรายการนี้');
    await loadWinners();
    say(`ลบประวัติผู้ได้รางวัลรหัส ${couponCode} แล้ว`);
  } catch(error) {
    console.error('Unable to remove coupon winner',error);
    say(`ลบผู้ได้รางวัลไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}\nตรวจสอบว่าได้รัน supabase/coupon_draw_winner_admin.sql แล้ว`);
  } finally {
    lock(false);
  }
}
async function deleteSubmission(couponCode) {
  const event = currentEvent();
  if (busy || !existing.has(event)) return;
  if (!confirm(`ยืนยันลบรายการคูปอง ${couponCode} ของงาน “${event}” ?\nการลบนี้ไม่สามารถกู้คืนได้`)) return;
  lock(true);
  try {
    const result = check(await _supabase.from('coupon_submissions').delete().eq('event',event).eq('coupon_code',couponCode).select('coupon_code'));
    if (!result.data?.length) throw new Error('ไม่พบรายการนี้ หรือไม่มีสิทธิ์ลบ');
    await loadSubmissions();
    say(`ลบรายการ ${couponCode} แล้ว`);
  } catch(error) {
    failure(error);
  } finally {
    lock(false);
  }
}
async function loadEvents() {
  const {data} = check(await _supabase.from('coupon_event_json').select('event').order('event'));
  existing = new Set(data.map(row=>row.event));
  $('saved-events').replaceChildren(new Option('เลือกงาน หรือระบุงานใหม่ด้านล่าง',''));
  for (const row of data) $('saved-events').add(new Option(row.event,row.event));
}
function failure(error) { say(`ดำเนินการไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}\nตรวจสอบว่ารัน supabase/coupon_admin_access.sql และ supabase/coupon_draw_winner_admin.sql ใน Supabase SQL Editor แล้ว`); }
async function loadInitialEvent() {
  const requestedEvent = new URLSearchParams(location.search).get('event');
  if (!requestedEvent || !existing.has(requestedEvent)) return;
  $('saved-events').value = requestedEvent;
  await loadSavedEvent(requestedEvent);
}
async function init() {
  if (typeof _supabase === 'undefined') { say('โหลดการเชื่อมต่อไม่สำเร็จ กรุณาโหลดหน้าใหม่'); return; }
  $('event').value = new URLSearchParams(location.search).get('event') || '';
  await loadEvents();
  await loadInitialEvent();
}
$('event').addEventListener('input',()=>{
  if ($('saved-events').value && $('saved-events').value !== currentEvent()) {
    fields=[]; submissions=[]; winners=[]; renderFields(); renderSubmissions(); renderWinners();
  }
  preview();
});
$('excel').addEventListener('change',()=>{codes=[];preview();$('summary').textContent='กดอ่าน Excel เพื่อแปลงไฟล์ใหม่';});
async function loadSavedEvent(event) {
  if (!event || busy) return;
  lock(true); codes=[]; preview();
  try {
    const {data} = check(await _supabase.from('coupon_event_json').select('codes,form_fields').eq('event',event).single());
    $('event').value = event; codes = data.codes; fields = Array.isArray(data.form_fields) ? data.form_fields : []; $('excel').value = '';
    $('summary').textContent = `JSON ที่บันทึกไว้: ${codes.length.toLocaleString()} รหัส`;
    preview(); renderFields(); link(); await loadSubmissions(); await loadWinners(); say('โหลดข้อมูลของงานแล้ว');
  } catch(error){failure(error);}finally{lock(false);}
}
$('saved-events').addEventListener('change',()=>loadSavedEvent($('saved-events').value));
$('read').addEventListener('click',async()=>{
  if (busy) return;
  const file = $('excel').files[0];
  if (!file || !/\.xlsx$/i.test(file.name)) {say('กรุณาเลือกไฟล์ .xlsx');return;}
  if (!currentEvent() || currentEvent().length>120) {say('กรุณาระบุ event ไม่เกิน 120 ตัวอักษร');return;}
  lock(true); codes=[];preview();
  try {
    if (file.size>15*1024*1024) throw Error('ไฟล์ต้องไม่เกิน 15 MB');
    if (typeof XLSX==='undefined') throw Error('โหลดตัวอ่าน Excel ไม่สำเร็จ กรุณาโหลดหน้าใหม่');
    const book=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const cells=book.SheetNames.flatMap(name=>XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,raw:false,defval:''}).flat());
    const parsed=parseCouponCells(cells);
    $('summary').textContent=`รหัสไม่ซ้ำ ${parsed.codes.length.toLocaleString()} · ซ้ำ ${parsed.duplicates} · หัวตาราง ${parsed.headers} · ไม่ถูกต้อง ${parsed.invalid.length}`;
    if (parsed.invalid.length) throw Error('กรุณาแก้ข้อมูลที่ไม่ใช่รหัส 6–7 ตัวก่อน: '+parsed.invalid.slice(0,10).join(', '));
    if (!parsed.codes.length) throw Error('ไม่พบรหัสในไฟล์');
    codes=parsed.codes;preview();say('แปลง Excel เป็น JSON แล้ว กดบันทึกเพื่อให้หน้ากรอกเริ่มใช้ข้อมูลชุดนี้');
  }catch(error){failure(error);}finally{lock(false);}
});
$('save').addEventListener('click',async()=>{
  if (busy || !codes.length || !currentEvent()) return;
  const event=currentEvent();
  if (existing.has(event) && !confirm(`แทนที่ JSON ของงาน “${event}” ด้วย ${codes.length.toLocaleString()} รหัส?`)) return;
  lock(true);
  try {
    check(await _supabase.from('coupon_event_json').upsert({event,codes,form_fields:fields,updated_at:new Date().toISOString()},{onConflict:'event'}));
    await loadEvents();$('saved-events').value=event;link();renderFields();await loadSubmissions();say(`บันทึก JSON และฟิลด์ของ ${event} แล้ว ${codes.length.toLocaleString()} รหัส`);
  }catch(error){failure(error);}finally{lock(false);}
});
$('download').addEventListener('click',()=>{
  if (!codes.length || !currentEvent()) return;
  const blob=new Blob([JSON.stringify({event:currentEvent(),codes},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='coupons-'+safeFileName(currentEvent())+'.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('add-field').addEventListener('click',()=>{ fields.push({label:'',type:'text',options:[],required:false}); renderFields(); });
$('save-fields').addEventListener('click',async()=>{
  if (!existing.has(currentEvent())) return;
  const normalized = fields.map(field => ({...field,label:String(field.label || '').trim(),type:field.type === 'select' ? 'select' : 'text',options:field.type === 'select' ? (field.options || []).filter(Boolean) : [],required:Boolean(field.required)}));
  if (normalized.some(field => !field.label)) { say('กรุณาระบุชื่อฟิลด์ให้ครบ'); return; }
  if (normalized.some(field => field.type === 'select' && !field.options.length)) { say('กรุณาระบุตัวเลือกของ dropdown อย่างน้อย 1 รายการ'); return; }
  if (new Set(normalized.map(field => field.label)).size !== normalized.length) { say('ชื่อฟิลด์ต้องไม่ซ้ำกัน'); return; }
  lock(true);
  try {
    const result = await _supabase.from('coupon_event_json').update({form_fields:normalized,updated_at:new Date().toISOString()}).eq('event',currentEvent());
    check(result); fields=normalized; renderFields(); await loadSubmissions(); say('บันทึกฟิลด์ของงานแล้ว');
  } catch(error) { failure(error); } finally { lock(false); }
});
$('refresh-submissions').addEventListener('click',async()=>{ try { await loadSubmissions(); } catch(error) { failure(error); } });
$('refresh-winners').addEventListener('click',async()=>{ try { await loadWinners(); } catch(error) { failure(error); } });
$('reset-winners').addEventListener('click',async()=>{
  const event = currentEvent();
  if (busy || !existing.has(event)) return;
  if (!confirm(`ยืนยัน Reset ผู้ได้รางวัลของงาน “${event}” ?\nจะลบเฉพาะประวัติผลจับรางวัล และสามารถจับใหม่ได้`)) return;
  lock(true);
  try {
    check(await _supabase.rpc('coupon_draw_reset',{p_event:event}));
    await loadWinners();
    say(`Reset ผลจับรางวัลของ ${event} แล้ว สามารถเริ่มจับรางวัลใหม่ได้`);
  } catch(error) {
    console.error('Unable to reset coupon draw winners',error);
    say(`Reset ไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}\nตรวจสอบว่ารัน supabase/coupon_admin_access.sql และ supabase/coupon_draw_reset.sql แล้ว`);
  } finally {
    lock(false);
  }
});
$('export-submissions').addEventListener('click',()=>{
  if (!submissions.length) return;
  const fieldLabels = submissionFieldLabels();
  const columns = ['ลงทะเบียนเมื่อ','รหัสคูปอง',...fieldLabels];
  const rows = submissions.map(row => [row.created_at,row.coupon_code,...fieldLabels.map(label => row.details?.[label] || '')]);
  const csv = '\uFEFF'+[columns,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');
  a.href=url;a.download='submissions-'+safeFileName(currentEvent())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
init().catch(failure);
