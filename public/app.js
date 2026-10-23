const form = document.getElementById('generator-form');
const submitBtn = document.getElementById('submitBtn');
const fillDemoBtn = document.getElementById('fillDemoBtn');
const resultSection = document.getElementById('resultSection');
const warningBox = document.getElementById('warningBox');
const previewBody = document.getElementById('previewBody');
const autoUrl = document.getElementById('autoUrl');
const rawUrl = document.getElementById('rawUrl');
const clashUrl = document.getElementById('clashUrl');
const surgeUrl = document.getElementById('surgeUrl');
const emptyState = document.getElementById('emptyState');
const qrModal = document.getElementById('qrModal');
const qrCanvas = document.getElementById('qrCanvas');
const qrText = document.getElementById('qrText');
const closeQrModal = document.getElementById('closeQrModal');
const preferredApiUrl = document.getElementById('preferredApiUrl');
const fetchPreferredApiBtn = document.getElementById('fetchPreferredApiBtn');
const preferredApiStatus = document.getElementById('preferredApiStatus');

const demoVmess = [
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ=='
].join('\n');

const demoIps = [
  '104.16.1.2#HK-01',
  '104.17.2.3#HK-02',
  '104.18.3.4:2053#US-Edge'
].join('\n');

fillDemoBtn.addEventListener('click', () => {
  document.getElementById('nodeLinks').value = demoVmess;
  document.getElementById('preferredIps').value = demoIps;
  document.getElementById('namePrefix').value = 'CF';
  document.getElementById('keepOriginalHost').checked = true;
});

async function parseApiResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  if (!data) {
    if (contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(raw) || /^\s*<html[\s>]/i.test(raw)) {
      throw new Error('当前页面是 Cloudflare Pages，/api 接口没有运行 Worker。请将项目部署为 Cloudflare Worker 后再试。');
    }
    throw new Error(`${fallbackMessage}：服务器返回的不是合法 JSON（HTTP ${response.status}）。`);
  }
  return data;
}

async function fetchPreferredApiItems(apiUrl) {
  const response = await fetch('/api/fetch-preferred', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: apiUrl }),
  });
  const data = await parseApiResponse(response, '获取优选 IP 失败');
  if (!response.ok || !data.ok) throw new Error(data.error || '获取优选 IP 失败');
  return Array.isArray(data.items) ? data.items : [];
}

fetchPreferredApiBtn.addEventListener('click', async () => {
  const apiUrl = preferredApiUrl.value.trim();
  if (!apiUrl) {
    setApiStatus('请先填写优选 API 地址。', true);
    preferredApiUrl.focus();
    return;
  }
  if (!/^https?:\/\//i.test(apiUrl)) {
    setApiStatus('API 地址必须以 http:// 或 https:// 开头。', true);
    return;
  }

  fetchPreferredApiBtn.disabled = true;
  fetchPreferredApiBtn.textContent = '获取中...';
  setApiStatus('正在请求优选 API...', false);

  try {
    const items = await fetchPreferredApiItems(apiUrl);
    const textarea = document.getElementById('preferredIps');
    const current = textarea.value.trim();
    const incoming = items.join('\n');
    textarea.value = current ? `${current}\n${incoming}` : incoming;
    setApiStatus(`成功获取 ${items.length} 个优选地址，已追加到优选框。`, false);
  } catch (error) {
    setApiStatus(error.message || '请求失败，请检查 API 地址。', true);
  } finally {
    fetchPreferredApiBtn.disabled = false;
    fetchPreferredApiBtn.textContent = '获取优选 IP';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  warningBox.classList.add('hidden');
  previewBody.innerHTML = '';

  let preferredIps = document.getElementById('preferredIps').value;
  const apiUrl = preferredApiUrl.value.trim();

  if (apiUrl) {
    if (!/^https?:\/\//i.test(apiUrl)) {
      warningBox.textContent = '优选 API 地址必须以 http:// 或 https:// 开头。';
      warningBox.classList.remove('hidden');
      preferredApiUrl.focus();
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '获取优选 API...';
    setApiStatus('生成订阅前正在自动获取优选地址...', false);
    try {
      const items = await fetchPreferredApiItems(apiUrl);
      const currentLines = preferredIps.trim();
      const incoming = items.join('\n');
      preferredIps = currentLines ? `${currentLines}\n${incoming}` : incoming;
      document.getElementById('preferredIps').value = preferredIps;
      setApiStatus(`API 已自动加入本次订阅：${items.length} 个优选地址。`, false);
    } catch (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = '生成订阅';
      warningBox.textContent = error.message || '优选 API 请求失败';
      warningBox.classList.remove('hidden');
      return;
    }
  }

  const payload = {
    nodeLinks: document.getElementById('nodeLinks').value,
    preferredIps,
    namePrefix: document.getElementById('namePrefix').value,
    keepOriginalHost: document.getElementById('keepOriginalHost').checked,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = '生成中...';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseApiResponse(response, '生成订阅失败');
    if (!response.ok || !data.ok) throw new Error(data.error || '生成失败');

    autoUrl.value = data.urls.auto;
    rawUrl.value = data.urls.raw;
    document.getElementById('rocketUrl').value = data.urls.raw;
    clashUrl.value = data.urls.clash;
    surgeUrl.value = data.urls.surge;
    emptyState.classList.add('hidden');
    document.getElementById('statInputNodes').textContent = data.counts.inputNodes;
    document.getElementById('statEndpoints').textContent = data.counts.preferredEndpoints;
    document.getElementById('statOutputNodes').textContent = data.counts.outputNodes;

    previewBody.innerHTML = data.preview.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.type)}</td>
        <td>${escapeHtml(item.server)}</td><td>${escapeHtml(String(item.port))}</td>
        <td>${escapeHtml(item.host || '-')}</td><td>${escapeHtml(item.sni || '-')}</td>
      </tr>`).join('');

    if (Array.isArray(data.warnings) && data.warnings.length) {
      warningBox.textContent = data.warnings.join('\n');
      warningBox.classList.remove('hidden');
    }
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    warningBox.textContent = error.message || '请求失败';
    warningBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '生成订阅';
  }
});

document.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-copy-target]');
  if (copyButton) {
    const input = document.getElementById(copyButton.dataset.copyTarget);
    if (!input?.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      const originalText = copyButton.textContent;
      copyButton.textContent = '已复制';
      setTimeout(() => { copyButton.textContent = originalText; }, 1200);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    return;
  }

  const qrButton = event.target.closest('[data-qrcode-target]');
  if (qrButton) {
    warningBox.classList.add('hidden');
    const input = document.getElementById(qrButton.dataset.qrcodeTarget);
    if (!input?.value) {
      warningBox.textContent = '请先生成订阅链接，再显示二维码。';
      warningBox.classList.remove('hidden');
      return;
    }
    if (!window.QRCode) {
      warningBox.textContent = '二维码组件加载失败，请刷新页面后重试。';
      warningBox.classList.remove('hidden');
      return;
    }
    qrCanvas.innerHTML = '';
    qrText.textContent = input.value;
    qrModal.classList.remove('hidden');
    qrModal.setAttribute('aria-hidden', 'false');
    new window.QRCode(qrCanvas, {
      text: input.value, width: 220, height: 220,
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    return;
  }
  if (event.target.closest('[data-close-modal="true"]')) closeQrDialog();
});

closeQrModal.addEventListener('click', closeQrDialog);

function closeQrDialog() {
  qrModal.classList.add('hidden');
  qrModal.setAttribute('aria-hidden', 'true');
  qrCanvas.innerHTML = '';
}

function setApiStatus(message, isError) {
  preferredApiStatus.textContent = message;
  preferredApiStatus.classList.toggle('error', Boolean(isError));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
