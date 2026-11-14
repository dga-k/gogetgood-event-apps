'use strict';
function parseCouponCells(values) {
  const codes = new Set();
  let duplicates = 0, headers = 0;
  const invalid = [];
  for (const raw of values) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    if (/^(ชุดที่\s*\d+\s*\(\d+\s*เลข\)|coupon[_ ]?code|code|รหัส|รหัสคูปอง)$/i.test(value)) { headers++; continue; }
    const code = value.toUpperCase();
    if (!/^[A-Z0-9]{6,7}$/.test(code)) { invalid.push(value); continue; }
    if (codes.has(code)) duplicates++;
    codes.add(code);
  }
  return {codes: [...codes], duplicates, headers, invalid};
}
