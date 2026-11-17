// Обычный (не модульный) скрипт: он выполняется и тогда, когда страница открыта файлом с диска.
// В этом режиме браузер блокирует скрипты-модули студии (file:// и CORS): стили видны, а кнопки не работают.
// Вместо молча «мёртвой» страницы показываем, как открыть студию правильно.
(function () {
  if (location.protocol !== 'file:') return;
  var page = location.pathname.split('/').pop() || 'index.html';
  var online = 'https://marcostavar24633-cyber.github.io/unique-design-studio/studio/' + (page === 'index.html' ? '' : page);
  var box = document.createElement('div');
  box.id = 'file-guard';
  box.setAttribute('role', 'alert');
  box.style.cssText = 'position:sticky;top:0;z-index:9999;margin:0;padding:14px 18px;background:#5a1d1a;color:#fff;font:15px/1.5 system-ui,sans-serif;border-bottom:2px solid #e07870';
  var title = document.createElement('b');
  title.textContent = 'Страница открыта как файл с диска — кнопки студии здесь не работают. ';
  var text = document.createElement('span');
  text.textContent = 'Браузер блокирует скрипты студии для адресов file://. Откройте опубликованную версию: ';
  var link = document.createElement('a');
  link.href = online; link.textContent = online; link.style.color = '#ffd9a0';
  var local = document.createElement('span');
  local.textContent = ' — или локально: npm start и адрес http://localhost:4173/studio/';
  box.append(title, text, link, local);
  var place = function () { document.body.insertBefore(box, document.body.firstChild); };
  if (document.body) place(); else document.addEventListener('DOMContentLoaded', place);
}());
