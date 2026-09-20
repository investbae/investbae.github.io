/* Local email drafts only: no network calls, storage or automatic mail launch. */
(function () {
  'use strict';
  var en = document.documentElement.lang.toLowerCase().indexOf('en') === 0;
  function msg(ko, english) { return en ? english : ko; }
  document.querySelectorAll('form[data-email-draft]').forEach(function (form) {
    var fields = form.querySelector('fieldset');
    var panel = document.createElement('section');
    panel.hidden = true;
    panel.style.cssText = 'margin-top:24px;padding:20px;border:1px solid currentColor;border-radius:12px;overflow-wrap:anywhere;';
    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var label = document.createElement('label');
    label.textContent = msg('이메일 본문 (선택하여 복사할 수 있습니다)', 'Email body (select to copy)');
    var bodyBox = document.createElement('textarea');
    bodyBox.readOnly = true;
    bodyBox.rows = 12;
    bodyBox.style.cssText = 'width:100%;box-sizing:border-box;';
    label.appendChild(bodyBox);
    var mail = document.createElement('a');
    mail.className = 'btn btn--primary';
    mail.textContent = msg('메일 앱 열기', 'Open mail app');
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn--ghost';
    copy.textContent = msg('본문 복사', 'Copy body');
    var hint = document.createElement('p');
    hint.textContent = msg('받는 사람: office@kvmi.co.kr. 메일 앱이 없으면 웹메일에 본문을 붙여 넣어 직접 보내세요. 실제 발송·접수 여부는 이 페이지에서 확인할 수 없습니다.', 'To: office@kvmi.co.kr. If no mail app is configured, paste the body into webmail and send it yourself. This page cannot verify delivery or receipt.');
    panel.append(status, hint, label, mail, document.createTextNode(' '), copy);
    form.appendChild(panel);
    function selectBody() { bodyBox.focus(); bodyBox.select(); }
    copy.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(bodyBox.value).then(function () {
          status.textContent = msg('본문을 복사했습니다. 아직 발송되지 않았습니다.', 'Body copied. No email has been sent.');
        }).catch(function () {
          selectBody();
          status.textContent = msg('본문을 선택했습니다. 복사 메뉴 또는 Ctrl/Cmd+C를 사용하세요.', 'Body selected. Use the copy menu or Ctrl/Cmd+C.');
        });
      } else {
        selectBody();
        status.textContent = msg('본문을 선택했습니다. 복사 메뉴 또는 Ctrl/Cmd+C를 사용하세요.', 'Body selected. Use the copy menu or Ctrl/Cmd+C.');
      }
    });
    function invalidate() {
      panel.hidden = true;
      mail.removeAttribute('href');
      bodyBox.value = '';
    }
    form.addEventListener('input', function (event) { if (fields.contains(event.target)) invalidate(); });
    form.addEventListener('change', function (event) { if (fields.contains(event.target)) invalidate(); });
    form.addEventListener('reset', invalidate);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      var signup = form.getAttribute('name') === 'signup';
      var subject = signup ? '[KVMI] 자료·소식 구독 신청' : msg('[KVMI] 연구·자문 문의', '[KVMI] Research inquiry');
      var lines = [subject, ''];
      new FormData(form).forEach(function (value, key) { lines.push(key + ': ' + String(value)); });
      fields.querySelectorAll('input[type=checkbox]').forEach(function (input) {
        if (!input.checked) lines.push(input.name + ': ' + msg('동의하지 않음', 'Not agreed'));
      });
      var body = lines.join('\r\n');
      if (body.length > 14000) {
        status.textContent = msg('입력 내용이 너무 깁니다. 내용을 줄여 다시 만들어 주세요.', 'Please shorten the entries and create the draft again.');
        panel.hidden = false;
        mail.hidden = true;
        copy.hidden = true;
        label.hidden = true;
        return;
      }
      bodyBox.value = body;
      var base = 'mailto:office@kvmi.co.kr?subject=' + encodeURIComponent(subject);
      var complete = base + '&body=' + encodeURIComponent(body);
      var longBody = complete.length > 1800;
      mail.href = longBody ? base : complete;
      mail.hidden = copy.hidden = label.hidden = false;
      status.textContent = msg('초안이 만들어졌습니다. 아직 발송·접수되지 않았습니다.', 'Draft created. It has not been sent or received.') + (longBody ? msg(' 본문이 길어 메일 링크에는 제목만 포함됩니다. 본문을 복사하여 붙여 넣으세요.', ' This draft is long: the mail link includes only the subject. Copy and paste the body.') : '');
      panel.hidden = false;
    });
    fields.disabled = false;
  });
})();
