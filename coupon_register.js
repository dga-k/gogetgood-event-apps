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

function showMessage(message, success = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('success', success);
}

function updateButton() {
  submitButton.disabled = saving || submitted || !validEvent || !clientReady || !/^[A-Za-z0-9]{6}$/.test(coupon.value.trim());
}

if (!validEvent) {
  showMessage('ไม่พบ event ที่ถูกต้อง กรุณาเปิดลิงก์ที่มี ?event=รหัสกิจกรรม (ไม่เกิน 120 ตัวอักษร)');
  coupon.disabled = true;
} else if (!clientReady) {
  showMessage('เชื่อมต่อระบบไม่สำเร็จ กรุณาโหลดหน้าใหม่อีกครั้ง');
}

coupon.addEventListener('input', () => {
  submitted = false;
  coupon.removeAttribute('aria-invalid');
  if (validEvent && clientReady) showMessage('');
  updateButton();
});

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
  if (!form.reportValidity()) return;

  saving = true;
  coupon.disabled = true;
  resetButton.disabled = true;
  submitButton.textContent = 'กำลังส่ง...';
  showMessage('กำลังบันทึกข้อมูล...');
  updateButton();

  try {
    const { error } = await _supabase.from('coupon_submissions').insert({
      event: eventCode,
      coupon_code: coupon.value
    });
    if (error) {
      if (error.code === '23505') {
        coupon.setAttribute('aria-invalid', 'true');
        showMessage('รหัสคูปองนี้ถูกลงทะเบียนในกิจกรรมนี้แล้ว');
      } else {
        showMessage('บันทึกไม่สำเร็จ กรุณาลองใหม่ หากยังพบปัญหาให้ติดต่อเจ้าหน้าที่');
      }
      return;
    }
    submitted = true;
    showMessage('บันทึกรหัสคูปองเรียบร้อยแล้ว ขอให้โชคดี! หากต้องการส่งรหัสอื่น กรุณาล้างแบบฟอร์ม', true);
  } catch {
    showMessage('เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  } finally {
    saving = false;
    coupon.disabled = false;
    resetButton.disabled = false;
    submitButton.textContent = 'ส่ง';
    updateButton();
  }
});
