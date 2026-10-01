// House font for drafted emails: Aptos, 11pt, black. Applied as inline styles because mail clients
// ignore stylesheets and would otherwise use their own default. These are literal values (not design
// tokens) on purpose: the HTML leaves the app, so CSS variables would not resolve.
export const EMAIL_FONT_FAMILY = "Aptos, Calibri, Arial, sans-serif";
export const EMAIL_FONT_SIZE = '11pt';
export const EMAIL_FONT_COLOR = '#000000';

const BASE_STYLE = `font-family: ${EMAIL_FONT_FAMILY}; font-size: ${EMAIL_FONT_SIZE}; color: ${EMAIL_FONT_COLOR};`;

/**
 * Returns the email HTML with Aptos 11pt black set inline on every element (headings bold, same size
 * as body text), wrapped in a div carrying the same style. Existing inline styles are kept except for
 * the font family, size and colour, which are overridden.
 */
export function applyEmailFont(html) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  root.querySelectorAll('*').forEach(el => {
    if (el.tagName === 'BR') return;
    el.style.fontFamily = EMAIL_FONT_FAMILY;
    el.style.fontSize = EMAIL_FONT_SIZE;
    el.style.color = EMAIL_FONT_COLOR;
    if (/^H[1-6]$/.test(el.tagName)) {
      el.style.fontWeight = 'bold';
      el.style.margin = '12pt 0 4pt';
    }
  });

  root.setAttribute('style', BASE_STYLE);
  return root.outerHTML;
}
