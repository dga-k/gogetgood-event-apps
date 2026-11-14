'use strict';
const $ = id => document.getElementById(id);
let codes = [], busy = false;
let existing = new Set();
const say = text => { $('status').textContent = text; };
function check(result) { if (result.error) throw result.error; return result; }
function currentEvent() { return $('event').value.trim(); }
function buttons() {
  $('save').disabled = busy || !codes.length || !currentEvent() || currentEvent().length > 120;
  $('download').disabled = $('save').disabled;
}
function lock(value) {
  busy = value;
  for (const id of ['event','excel','saved-events','read']) $(id).disabled = value;
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
  $('register-link').replaceChildren('หน้ากรอกตัวเลข: ',a);
}
async function loadEvents() {
  const {data} = check(await _supabase.from('coupon_event_json').select('event').order('event'));
  existing = new Set(data.map(row=>row.event));
  $('saved-events').replaceChildren(new Option('เลือกงาน หรือระบุงานใหม่ด้านล่าง',''));
  for (const row of data) $('saved-events').add(new Option(row.event,row.event));
}
function failure(error) { say(`ดำเนินการไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}\nตรวจสอบว่ารัน coupon_json.sql เวอร์ชันไม่ต้องเข้าสู่ระบบแล้ว`); }
async function init() {
  if (typeof _supabase === 'undefined') { say('โหลดการเชื่อมต่อไม่สำเร็จ กรุณาโหลดหน้าใหม่'); return; }
  $('event').value = new URLSearchParams(location.search).get('event') || '';
  await loadEvents();
}
$('event').addEventListener('input',preview);
$('excel').addEventListener('change',()=>{codes=[];preview();$('summary').textContent='กดอ่าน Excel เพื่อแปลงไฟล์ใหม่';});
$('saved-events').addEventListener('change',async()=>{
  const event = $('saved-events').value; if (!event || busy) return;
  lock(true); codes=[]; preview();
  try {
    const {data} = check(await _supabase.from('coupon_event_json').select('codes').eq('event',event).single());
    $('event').value = event; codes = data.codes; $('excel').value = '';
    $('summary').textContent = `JSON ที่บันทึกไว้: ${codes.length.toLocaleString()} รหัส`;
    preview(); link(); say('โหลด JSON ของงานแล้ว');
  } catch(error){failure(error);}finally{lock(false);}
});
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
    check(await _supabase.from('coupon_event_json').upsert({event,codes,updated_at:new Date().toISOString()},{onConflict:'event'}));
    await loadEvents();$('saved-events').value=event;link();say(`บันทึก JSON ของ ${event} แล้ว ${codes.length.toLocaleString()} รหัส`);
  }catch(error){failure(error);}finally{lock(false);}
});
$('download').addEventListener('click',()=>{
  if (!codes.length || !currentEvent()) return;
  const blob=new Blob([JSON.stringify({event:currentEvent(),codes},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='coupons-'+currentEvent().replace(/[^a-zA-Z0-9ก-๙_-]/g,'_')+'.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
init().catch(failure);
