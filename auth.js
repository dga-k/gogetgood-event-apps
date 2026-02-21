const SUPABASE_URL = 'https://sqicbdurboqyslqwptyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Jtn64Z8U54LeCkYWomwfGw_MQdPYyxz';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const PDF_URL = 'https://sqicbdurboqyslqwptyd.supabase.co/storage/v1/object/public/receipts/1767870048806_receipt';

// ฟังก์ชันเช็คสถานะ Login และ Redirect
async function protectPage() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session && !window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
    }
    return session;
}

async function handleLogout() {
    await _supabase.auth.signOut();
    window.location.href = 'login.html';
}