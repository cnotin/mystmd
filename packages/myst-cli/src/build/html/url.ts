import type { ISession } from '../../session/types.js';
import { selectors } from '../../store/index.js';

/**
 * Return the configured public site URL, when one is available.
 *
 * @param session session with logging
 */
export function getSiteUrl(session: ISession): string | undefined {
  const siteConfig = selectors.selectCurrentSiteConfig(session.store.getState());
  // SITE_URL always takes precedence. If it is not defined, use site.url or the Read the Docs URL.
  const value = process.env.SITE_URL || siteConfig?.url || process.env.READTHEDOCS_CANONICAL_URL;
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`SITE_URL or site.url must be an absolute URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error(
      `SITE_URL or site.url must be an absolute http(s) URL without a query or fragment: ${value}`,
    );
  }
  return url.href.replace(/\/+$/, '');
}

function normalizeBaseUrl(value?: string): string | undefined {
  const baseUrl = value?.replace(/\/+$/, '') || undefined;
  if (!baseUrl) return undefined;
  if (!baseUrl.startsWith('/') || baseUrl.startsWith('//') || /[?#]/.test(baseUrl)) {
    throw new Error(`BASE_URL must be a path beginning with "/": ${baseUrl}`);
  }
  return baseUrl;
}

/**
 * Get the base URL from BASE_URL or the pathname of the public site URL.
 *
 * @param session session with logging
 */
export function getBaseUrl(session: ISession): string | undefined {
  const siteUrl = getSiteUrl(session);
  // BASE_URL takes precedence; otherwise use the deployment path in the configured public site URL.
  const inferredBaseUrl = siteUrl
    ? new URL(siteUrl).pathname.replace(/\/+$/, '') || undefined
    : undefined;
  const hasBaseUrl = !!process.env.BASE_URL;
  const baseUrl = normalizeBaseUrl(process.env.BASE_URL);
  if (hasBaseUrl && siteUrl !== undefined && baseUrl !== inferredBaseUrl) {
    throw new Error(`BASE_URL (${baseUrl ?? '/'}) conflicts with the path in ${siteUrl}`);
  }
  const resolvedBaseUrl = baseUrl ?? inferredBaseUrl;
  // Report the resolved base URL, or explain how to configure one when neither source is set.
  if (resolvedBaseUrl) {
    session.log.info(`Building the site with a baseurl of "${resolvedBaseUrl}"`);
  } else if (siteUrl) {
    session.log.info(`Building the site at "${siteUrl}"`);
  } else {
    session.log.info(
      'Building the base site.\nSet site.url (or SITE_URL) to configure public URLs, or BASE_URL for a path-only deployment prefix.',
    );
  }
  return resolvedBaseUrl;
}
