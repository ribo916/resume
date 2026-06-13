// @ts-check

/**
 * Attach console/page error collection to a page.
 * Returns an array that accumulates error strings; assert it's empty at test end.
 * Ignores the well-known Chrome DevTools probe 404 (.well-known/...) which is
 * browser noise, not a site error.
 */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.includes('.well-known/appspecific')) return; // devtools probe
      if (t.includes('favicon.ico')) return;             // missing favicon, harmless
      errors.push('console.error: ' + t);
    }
  });
  return errors;
}

module.exports = { collectErrors };
