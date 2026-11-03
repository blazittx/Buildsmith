function isAllowedHost(hostname, domains) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

module.exports = { isAllowedHost };
