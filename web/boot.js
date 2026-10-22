// Keep a readable recovery screen even when the installed Android WebView is old.
function unavailable(message){
 var app=document.getElementById('app');
 app.textContent='';
 var panel=document.createElement('div');panel.style.cssText='padding:40px 24px;color:#eff5ef;font:16px/1.7 system-ui';
 var title=document.createElement('h1');title.textContent='Управдом';panel.appendChild(title);
 var text=document.createElement('p');text.textContent=message;panel.appendChild(text);app.appendChild(panel);
}
if(!Array.prototype.at||!window.structuredClone||!Object.hasOwn||!window.HTMLDialogElement||!CanvasRenderingContext2D.prototype.roundRect){
 unavailable('Обновите Android System WebView или браузер, чтобы запустить игру. Сохранения останутся на устройстве. Требуется WebView / Chromium 100 или новее.');
}else{
 import('./app.js').catch(function(error){
  console.error(error);
  unavailable('Не удалось запустить игру. Закройте приложение и откройте снова. Если ошибка повторится, обновите приложение. Ваше сохранение не удалено.');
 });
}
