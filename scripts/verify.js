const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-verify-'));
const dbPath = path.join(tmp, 'verify.sqlite');
const uploadDir = path.join(tmp, 'uploads');
const key = Buffer.alloc(32, 7).toString('base64');
let child;
let base;
let serverOutput='';

async function freePort() {
  return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(error=>error?reject(error):resolve(port));});});
}
async function api(route, session, method='GET', body, extra={}) {
  const headers={...extra};
  if(session?.cookie)headers.cookie=session.cookie;
  if(body!==undefined)headers['content-type']='application/json';
  if(session?.csrf&&method!=='GET')headers['x-csrf-token']=session.csrf;
  const response=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const payload=response.status===204?null:await response.json().catch(()=>null);
  return {response,payload};
}
async function login(email,password,role) {
  const {response,payload}=await api('/api/auth/login',null,'POST',{email,password,...(role?{role}:{})});
  assert.equal(response.status,200,`login ${email}: ${JSON.stringify(payload)}`);
  return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:payload.csrfToken,user:payload.user,redirect:payload.redirect};
}
async function waitForServer() {
  for(let attempt=0;attempt<80;attempt++){
    if(child.exitCode!==null)throw new Error('Server exited during startup.');
    try{const response=await fetch(base+'/api/tenant/branding');if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Server did not become ready.');
}

(async()=>{
  const port=await freePort();base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,NODE_ENV:'development',PORT:String(port),TREVY_DB_PATH:dbPath,TREVY_UPLOAD_DIR:uploadDir,TREVY_ENCRYPTION_KEY:key},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',chunk=>serverOutput+=chunk);child.stderr.on('data',chunk=>serverOutput+=chunk);
  await waitForServer();
  const database=new Database(dbPath,{readonly:true});
  const migrations=database.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row=>row.version);
  assert.equal(migrations.length,8,'all versioned migrations applied to an empty database');
  assert.equal(database.pragma('foreign_keys')[0].foreign_keys,1,'foreign keys enabled');
  for(const table of ['tenant_settings','roles','permissions','role_permissions','user_groups','uploads','audit_log','student_profiles','tutor_details','subjects','tutor_availability','packages','learning_subscriptions','learning_sessions','session_reviews','attendance_evidence','user_preferences'])assert(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table),`missing table ${table}`);
  database.close();

  const admin=await login('admin@trevy.id','admin123','admin');
  const rolesResult=await api('/api/admin/roles',admin);assert.equal(rolesResult.response.status,200);
  const createdGroup=await api('/api/admin/groups',admin,'POST',{name:'Tim Pengujian',description:'Grup verifikasi otomatis'});assert.equal(createdGroup.response.status,201);
  const roleExpectations={keuangan:['transaction.manage','accounting.manage','payroll.manage','withdrawal.manage'],marketing:['package.manage','promo.manage','enrollment.report'],front_office:['people.manage','booking.manage','documents.basic_verify'],back_office:['tutor.verify','attendance.manage','operations.manage']};
  const staff=[];
  for(const [role,permissions] of Object.entries(roleExpectations)){
    const email=`${role}@example.test`;
    const created=await api('/api/admin/users',admin,'POST',{name:`Petugas ${role}`,email,password:'password-aman-123',role,groupId:createdGroup.payload.id});assert.equal(created.response.status,201,JSON.stringify(created.payload));
    const user=await login(email,'password-aman-123');assert.equal(user.redirect,'/dashboard-staff.html');
    const context=await api('/api/staff/context',user);assert.equal(context.response.status,200);for(const permission of permissions)assert(context.payload.permissions.includes(permission),`${role} missing ${permission}`);
    const page=await fetch(base+user.redirect,{headers:{cookie:user.cookie}});assert.equal(page.status,200);assert((await page.text()).includes('Dashboard Staf'));
    const denied=await api('/api/admin/transactions',user);assert.equal(denied.response.status,403,`${role} must not enter super-admin API`);
    staff.push(role);
  }
  const marketing=await login('marketing@example.test','password-aman-123');
  const packageCreated=await api('/api/packages',marketing,'POST',{name:'Paket Verifikasi',price:250000,sessions:3,durationMinutes:90});assert.equal(packageCreated.response.status,201,JSON.stringify(packageCreated.payload));
  const noSession=await api('/api/admin/users',null);assert.equal(noSession.response.status,401);

  const student=await login('siswa@trevy.id','siswa123','student');
  const payment=await api('/api/payments/simulate',student,'POST',{packageId:'monthly',gateway:'midtrans'},{'idempotency-key':'verify-checkout-20261120-00001'});assert.equal(payment.response.status,201,JSON.stringify(payment.payload));
  const duplicate=await api('/api/payments/simulate',student,'POST',{packageId:'monthly',gateway:'midtrans'},{'idempotency-key':'verify-checkout-20261120-00001'});assert.equal(duplicate.response.status,200);assert.equal(duplicate.payload.duplicate,true);
  const financial=await api('/api/student/financial',student);assert.equal(financial.payload.subscription.remaining,14);

  const tutor=await login('guru@trevy.id','guru123','tutor');
  const availability=await api('/api/tutor/availability',tutor,'PUT',{slots:[{day:'Senin',time:'14:00 - 17:00'}]});assert.equal(availability.response.status,200);
  const nextMonday=new Date();nextMonday.setDate(nextMonday.getDate()+((8-nextMonday.getDay())%7||7));
  const localDate=nextMonday.toISOString().slice(0,10);const scheduledAt=new Date(`${localDate}T14:00:00+07:00`).toISOString();
  const match=await api(`/api/student/bookings/match?subject=Matematika&scheduledAt=${encodeURIComponent(scheduledAt)}`,student);assert.equal(match.response.status,200,JSON.stringify(match.payload));
  const booking=await api('/api/student/bookings',student,'POST',{subject:'Matematika',scheduledAt,freeTrial:false});assert.equal(booking.response.status,201,JSON.stringify(booking.payload));
  const tutorSchedule=await api('/api/tutor/sessions',tutor);assert(tutorSchedule.payload.some(session=>session.id===booking.payload.id));
  const checkin=await api('/api/tutor/checkin',tutor,'POST',{sessionId:booking.payload.id,latitude:-7.05,longitude:110.44});assert.equal(checkin.response.status,201);
  const png=Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  const evidence=await api('/api/tutor/evidence',tutor,'POST',{name:'bukti.png',mimeType:'image/png',data:png});assert.equal(evidence.response.status,201,JSON.stringify(evidence.payload));
  const checkout=await api('/api/tutor/checkout',tutor,'POST',{topic:'Persamaan linear'});assert.equal(checkout.response.status,201,JSON.stringify(checkout.payload));
  const attendance=await api('/api/admin/attendance',admin);const attendanceRow=attendance.payload.find(item=>item.id===checkout.payload.id);assert(attendanceRow?.hasEvidence);
  const review=await api(`/api/admin/attendance/${encodeURIComponent(checkout.payload.id)}/review`,admin,'POST',{decision:'approve'});assert.equal(review.response.status,200);
  const studentSessions=await api('/api/student/sessions',student);assert(studentSessions.payload.some(session=>session.id===booking.payload.id&&session.status==='completed'));
  const rating=await api(`/api/student/sessions/${encodeURIComponent(booking.payload.id)}/review`,student,'POST',{rating:5,comment:'Jelas dan membantu'});assert.equal(rating.response.status,201);
  const tutorFinancial=await api('/api/tutor/financial',tutor);assert.equal(tutorFinancial.payload.wallet.available,2500000);
  const profile=await api('/api/tutor/profile',tutor,'PUT',{bank:'BCA',accountNumber:'1234567890',accountName:'Budi Wicaksono',phone:'+62812345678'});assert.equal(profile.response.status,200);
  const withdrawal=await api('/api/tutor/withdrawals',tutor,'POST',{amount:100000});assert.equal(withdrawal.response.status,201);
  const reviewWithdrawal=await api(`/api/admin/withdrawals/${encodeURIComponent(withdrawal.payload.id)}/review`,admin,'POST',{decision:'transfer'});assert.equal(reviewWithdrawal.response.status,200);

  const branding=await api('/api/admin/settings/branding',admin,'PUT',{data:{platformName:'Portal Uji',tagline:'Belajar bersama',primaryColor:'#2355aa'}});assert.equal(branding.response.status,200);
  const secret=await api('/api/admin/settings/payment',admin,'PUT',{data:{provider:'xendit',mode:'test',secretKey:'secret-verify-do-not-return',webhookVerificationToken:'token-verify-do-not-return'}});assert.equal(secret.response.status,200);assert(!JSON.stringify(secret.payload).includes('secret-verify-do-not-return'));
  const photo=await api('/api/account/uploads',student,'POST',{purpose:'profile_photo',name:'foto.png',mimeType:'image/png',data:png});assert.equal(photo.response.status,201);
  const refreshed=await api('/api/auth/session',student);assert(refreshed.payload.user.profilePhotoUrl);
  const databaseCheck=new Database(dbPath,{readonly:true});const storedPayment=databaseCheck.prepare("SELECT payment_settings FROM tenant_settings WHERE tenant_id='default'").get().payment_settings;assert(!storedPayment.includes('secret-verify-do-not-return'));assert(databaseCheck.prepare('SELECT count(*) AS count FROM audit_log').get().count>0);databaseCheck.close();
  console.log(JSON.stringify({result:'PASS',migrations:migrations.length,staffRoles:staff,checkoutIdempotency:'PASS',bookingCheckinCheckoutReview:'PASS',payrollWithdrawal:'PASS',settingsSecretEncryption:'PASS',profileUpload:'PASS'}));
})().catch(error=>{console.error(error.stack||error);if(serverOutput)console.error(serverOutput);process.exitCode=1;}).finally(()=>{
  if(child&&!child.killed)child.kill('SIGTERM');
  setTimeout(()=>{try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}},250).unref();
});
