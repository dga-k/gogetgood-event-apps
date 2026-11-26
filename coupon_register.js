'use strict';

const eventCode = (new URLSearchParams(window.location.search).get('event') || '').trim();
const form = document.getElementById('coupon-form');
const coupon = document.getElementById('coupon');
const submitButton = document.getElementById('submit');
const resetButton = document.getElementById('reset');
const statusMessage = document.getElementById('status');
const validEvent = eventCode.length > 0 && eventCode.length <= 120;
const clientReady = typeof _supabase !== 'undefined';
let saving = false;
let submitted = false;
let eventFields = [];

if (validEvent) {
  document.getElementById('title').textContent = eventCode;
  document.title = eventCode;
}

function showMessage(message, success = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('success', success);
}

function updateButton() {
  submitButton.disabled = saving || submitted || !validEvent || !clientReady || !/^[A-Za-z0-9]{6,7}$/.test(coupon.value.trim()) || !form.checkValidity();
}

function renderExtraFields() {
  const container = document.getElementById('extra-fields');
  container.replaceChildren();
  eventFields.forEach((field, index) => {
    const section = document.createElement('div');
    section.className = 'card question extra-question';
    const label = document.createElement('label');
    label.htmlFor = `extra-${index}`;
    label.textContent = field.label;
    if (field.required) {
      const required = document.createElement('span');
      required.className = 'required';
      required.textContent = ' *';
      label.append(required);
    }
    let control;
    if (field.type === 'select') {
      control = document.createElement('select');
      control.add(new Option('กรุณาเลือก',''));
      (field.options || []).forEach(option => control.add(new Option(option,option)));
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.placeholder = 'คำตอบของคุณ';
      control.autocomplete = 'on';
    }
    control.id = `extra-${index}`;
    control.name = `extra-${index}`;
    control.required = Boolean(field.required);
    control.addEventListener('input', updateButton);
    control.addEventListener('change', updateButton);
    section.append(label,control);
    container.append(section);
  });
}

if (!validEvent) {
  showMessage('ไม่พบ event ที่ถูกต้อง กรุณาเปิดลิงก์ที่มี ?event=รหัสกิจกรรม (ไม่เกิน 120 ตัวอักษร)');
  coupon.disabled = true;
} else if (!clientReady) {
  showMessage('เชื่อมต่อระบบไม่สำเร็จ กรุณาโหลดหน้าใหม่อีกครั้ง');
} else {
  _supabase.from('coupon_event_json').select('form_fields').eq('event',eventCode).single().then(({data,error}) => {
    if (error || !data) throw error || new Error('ไม่พบข้อมูลกิจกรรม');
    eventFields = Array.isArray(data.form_fields) ? data.form_fields : [];
    renderExtraFields();
    updateButton();
  }).catch(() => {
    showMessage('โหลดแบบฟอร์มของงานไม่สำเร็จ กรุณาตรวจสอบลิงก์หรือลองใหม่');
    coupon.disabled = true;
  });
}

coupon.addEventListener('input', () => {
  submitted = false;
  coupon.removeAttribute('aria-invalid');
  if (validEvent && clientReady) showMessage('');
  updateButton();
});
form.addEventListener('input', updateButton);
form.addEventListener('change', updateButton);

form.addEventListener('reset', () => {
  submitted = false;
  coupon.removeAttribute('aria-invalid');
  if (validEvent && clientReady) showMessage('');
  submitButton.disabled = true;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving || submitted || !validEvent || !clientReady) return;
  coupon.value = coupon.value.trim().toUpperCase();
  form.querySelectorAll('input[type="text"]').forEach(input => { input.value = input.value.trim(); });
  if (!form.reportValidity()) return;

  saving = true;
  coupon.disabled = true;
  resetButton.disabled = true;
  form.querySelectorAll('input,select').forEach(control => { control.disabled = true; });
  submitButton.textContent = 'กำลังส่ง...';
  showMessage('กำลังบันทึกข้อมูล...');
  updateButton();

  try {
    const details = Object.fromEntries(eventFields.map((field,index) => [field.label,form.elements.namedItem(`extra-${index}`).value]));
    const { error } = await _supabase.from('coupon_submissions').insert({
      event: eventCode,
      coupon_code: coupon.value,
      details
    });
    if (error) {
      console.error('Coupon registration insert failed', {code:error.code,message:error.message,details:error.details,hint:error.hint});
      if (error.code === '23505') {
        coupon.setAttribute('aria-invalid', 'true');
        showMessage('รหัสคูปองนี้ถูกลงทะเบียนในกิจกรรมนี้แล้ว');
      } else if (error.message === 'COUPON_NOT_ALLOWED') {
        coupon.setAttribute('aria-invalid', 'true');
        showMessage('รหัสนี้ไม่ตรงกับรายการของงาน กรุณาตรวจสอบตัวเลขและลิงก์กิจกรรม');
      } else if (error.code === 'PGRST204' || error.code === '42703' || /column .*details.* does not exist/i.test(error.message || '')) {
        showMessage('ฐานข้อมูลยังไม่มีช่องเก็บข้อมูลเพิ่มเติม กรุณาให้ผู้ดูแลรัน supabase/coupon_custom_fields.sql ใน Supabase SQL Editor แล้วโหลดหน้านี้ใหม่');
      } else if (error.code === '42501' || /row-level security|permission denied/i.test(error.message || '')) {
        showMessage('ฐานข้อมูลปฏิเสธการบันทึก กรุณาให้ผู้ดูแลรัน supabase/coupon_custom_fields.sql เวอร์ชันล่าสุดใน Supabase SQL Editor แล้วโหลดหน้านี้ใหม่');
      } else {
        showMessage(`บันทึกไม่สำเร็จ (${error.code || 'ไม่ทราบรหัส'}): ${error.message || 'กรุณาติดต่อผู้ดูแลระบบ'}`);
      }
      return;
    }
    submitted = true;
    showMessage('บันทึกรหัสคูปองเรียบร้อยแล้ว ขอให้โชคดี! หากต้องการส่งรหัสอื่น กรุณาล้างแบบฟอร์ม', true);
  } catch (error) {
    console.error('Coupon registration request failed', error);
    showMessage('เชื่อมต่อหรือเรียกฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบ Console ของเบราว์เซอร์หรืออินเทอร์เน็ตแล้วลองใหม่');
  } finally {
    saving = false;
    coupon.disabled = false;
    resetButton.disabled = false;
    form.querySelectorAll('input,select').forEach(control => { control.disabled = false; });
    submitButton.textContent = 'ส่ง';
    updateButton();
  }
});
