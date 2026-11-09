// Change this one value when the public domain changes.
export const siteUrl = 'https://raavl.dev';

export function publicUrl(path = '/') {
  return new URL(path, siteUrl).href;
}
