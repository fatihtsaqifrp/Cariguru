document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.TrevyAPI?.ready;
  if (!user) return;
  const avatars = [...document.querySelectorAll('.sidebar__user .avatar,.main-content__actions > .avatar')];
  const applyPhoto = url => avatars.forEach(avatar => {
    avatar.replaceChildren();
    if (url) { const image=document.createElement('img');image.src=url;image.alt='Foto profil';avatar.append(image); }
    else avatar.textContent=user.name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
  });
  applyPhoto(user.profilePhotoUrl);
  const userBox=document.querySelector('.sidebar__user');
  if(!userBox)return;
  const button=document.createElement('button');button.type='button';button.className='profile-photo-change';button.textContent='Ubah foto';button.setAttribute('aria-label','Ubah foto profil');
  const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;input.setAttribute('aria-label','Pilih foto profil PNG, JPG, atau WebP');
  button.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){window.showToast?.('Foto harus PNG, JPG, atau WebP maksimal 2 MB.','warning');input.value='';return;}
    const local=URL.createObjectURL(file);applyPhoto(local);
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Foto tidak dapat dibaca.'));reader.readAsDataURL(file);});
      const result=await TrevyAPI.request('/api/account/uploads',{method:'POST',body:{purpose:'profile_photo',name:file.name,mimeType:file.type,data}});
      applyPhoto(result.url);window.showToast?.('Foto profil diperbarui.','success');
    }catch(error){applyPhoto(user.profilePhotoUrl);window.showToast?.(error.message,'danger');}
    finally{URL.revokeObjectURL(local);input.value='';}
  });
  userBox.append(button,input);
});
