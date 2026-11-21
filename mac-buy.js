(() => {
  const query = new URLSearchParams(location.search);
  const japanese = (query.get('lang') ?? navigator.language).toLowerCase().startsWith('ja');
  const strings = japanese ? {
    buyTitle: 'Mac版を続ける',
    terms: '月額1.49米ドル（税込）。初回のお支払いで契約が始まり、その日を基準に毎月自動更新します。',
    currency: 'Stripeが現地通貨でのお支払いを提示する場合があります。決済画面で換算レートと総額を確認できます。現地通貨の価格には換算手数料が含まれる場合があります。',
    compatible: 'macOS 15以降のMacで、2台まで利用できます。お支払いの管理にはLinkへのログインが必要です。利用を続けるには1日1回以上インターネットに接続してください。',
    cancel: '次回の請求を止めるには、更新日より前にLinkで解約してください。通常は支払い済みの期間まで利用できます。返金の対象と申請方法はLinkで確認できます。',
    manage: 'Linkでの管理・解約', refund: '返金条件',
    agree: '上記の月額料金と自動更新に同意します。',
    checkout: 'Stripeの決済へ進む', confirmationTitle: 'Mac版の契約',
    restore: '支払い後はMacアプリに戻ってください。「契約・利用状況」の「復元コードを表示」で、買い替えに備えてコードを保管できます。',
    download: 'Mac版をダウンロード', plus: '早期利用者の無償特典', support: 'サポート', privacy: 'プライバシー',
    unavailable: '現在、購入の受付を開始していません。',
    fromApp: 'カード不要の7日間トライアルはMacアプリから始められます。終了後、アプリで「月額1.49米ドルで続ける」を選んでください。',
    expired: 'この決済ページを利用できません。Macアプリからもう一度開いてください。すでにお支払いの場合は、アプリで「支払い状況を確認」を選んでください。',
    pending: '支払い確認を待っています。アプリに戻り「支払い状況を確認」を選ぶこともできます。',
    ready: '支払いを確認しました。Macアプリに戻ってください。',
    notReady: '利用権を確認できませんでした。サポートへお問い合わせください。',
    test: 'テスト決済',
  } : {
    unavailable: 'Purchases are not open yet.',
    fromApp: 'Start your 7-day trial in the Mac app without entering payment details. After the trial ends, choose “Continue for US$1.49/Month” in the app.',
    expired: 'This checkout is unavailable. Open it again from the Mac app. If you already paid, choose Check Purchase Status in the Mac app.',
    pending: 'We’re checking your payment. You can also choose Check Purchase Status in the Mac app.',
    ready: 'Your payment is confirmed. Return to the Mac app.',
    notReady: 'We could not confirm access. Please contact support.',
    test: 'Test checkout',
  };
  document.documentElement.lang = japanese ? 'ja' : 'en';
  if (japanese) document.title = 'Tap Pointer for Macの月額契約';
  for (const element of document.querySelectorAll('[data-copy]')) {
    const translated = strings[element.dataset.copy];
    if (translated) element.textContent = translated;
  }
  const api = location.hostname === '127.0.0.1' ? location.origin : 'https://purchase.tappointer.com';
  const version = '2026-11-21';
  const token = new URLSearchParams(location.hash.slice(1)).get('checkout');
  if (token) history.replaceState(null, '', location.pathname + location.search);
  const checkoutId = query.get('session_id') ?? history.state?.checkoutId;
  const byId = id => document.getElementById(id);

  async function get(path, options) {
    const response = await fetch(api + path, { ...options, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Purchase request failed');
    return response.json();
  }

  async function offer() {
    const label = byId('offer-status');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? '')) {
      label.textContent = strings.fromApp;
      return;
    }
    try {
      const data = await get('/v1/offer');
      if (data.termsVersion !== version || data.price !== 149 || data.currency !== 'usd' || data.interval !== 'month') {
        throw new Error('Invalid offer');
      }
      byId('consent-form').hidden = false;
      label.textContent = data.test ? strings.test : '';
    } catch {
      label.textContent = strings.unavailable;
    }
  }

  byId('consent-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = byId('checkout');
    if (!byId('agree').checked || button.disabled) return;
    button.disabled = true;
    try {
      const data = await get('/v1/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, termsVersion: version }),
      });
      const url = new URL(data.url);
      if (url.origin !== 'https://checkout.stripe.com' || url.username || url.password) throw new Error('Invalid checkout');
      location.assign(url.href);
    } catch {
      byId('offer-status').textContent = strings.expired;
      button.disabled = false;
    }
  });

  async function confirm() {
    byId('offer').hidden = true;
    byId('confirmation').hidden = false;
    query.delete('session_id');
    history.replaceState({ checkoutId }, '', location.pathname + (query.size ? '?' + query : ''));
    const label = byId('confirmation-status');
    label.textContent = strings.pending;
    if (!/^cs_(?:live|test)_[A-Za-z0-9_]{8,150}$/.test(checkoutId)) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const data = await get('/v1/order/status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId }),
        });
        if (data.status === 'ready' || data.status === 'unavailable') {
          label.textContent = data.status === 'ready' ? strings.ready : strings.notReady;
          return;
        }
      } catch {
        // The Mac app can also check payment status.
      }
      if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }

  if (checkoutId) void confirm();
  else void offer();
})();
