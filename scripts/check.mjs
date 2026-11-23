import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import './check-menu.mjs';

const root = resolve('dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(resolve(dir, e.name)) : resolve(dir, e.name)))).flat();
}
const files = await walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
let links = 0;
const errors = [];
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  if ((markup.match(/<h1[ >]/g) || []).length !== 1) errors.push(`${relative(root, file)}: expected one h1`);
  if (!markup.includes('<html lang="en">')) errors.push(`${file}: missing language`);
  const panelCount = (markup.match(/data-panel="/g) || []).length;
  const indicatorCount = (markup.match(/class="panel-dot /g) || []).length;
  if (!markup.includes('class="reel"') || !panelCount || panelCount !== indicatorCount) errors.push(`${file}: missing snap container or mismatched panel navigation`);
  if (markup.includes('letter-tile')) errors.push(`${file}: old O/M graphic is still present`);
  for (const mount of ['/', '/oscar-molina-portfolio/']) {
    const pagePath = relative(root, file).replace(/index\.html$/, '');
    const pageURL = new URL(mount + pagePath, 'https://portfolio.test');
    for (const [, attr, value] of markup.matchAll(/\b(href|src)="([^"]*)"/g)) {
      if (/^(mailto:|https?:|data:)/.test(value)) continue;
      const url = new URL(value, pageURL);
      if (attr === 'href' && !value.startsWith('#') && url.pathname.endsWith('/') && !url.searchParams.has('v')) errors.push(`${file}: unversioned page navigation ${value}`);
      if (!url.pathname.startsWith(mount)) { errors.push(`${file}: link escapes Pages base: ${value}`); continue; }
      let target = resolve(root, decodeURIComponent(url.pathname.slice(mount.length)));
      try {
        if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
        await stat(target);
        if (attr === 'href' && url.hash && target.endsWith('.html')) {
          const targetHTML = await readFile(target, 'utf8');
          if (!targetHTML.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) errors.push(`${relative(root, file)}: missing anchor ${value}`);
        }
        links++;
      } catch { errors.push(`${relative(root, file)}: missing ${value} (${relative(root, target)})`); }
    }
  }
}
const home = await readFile(resolve(root, 'index.html'), 'utf8');
if ((home.match(/data-panel="/g) || []).length !== 4) errors.push('Expected exactly four home panels');
if ((home.match(/class="panel-dot /g) || []).length !== 4) errors.push('Expected four panel indicators');
if (home.includes('Recent work') || home.includes('project-card')) errors.push('Home still contains recent work');
if (files.some(file => /works\/(graphic-design|photo-and-film|design-and-build)\//.test(file))) errors.push('Placeholder project pages still exist');
const projects = JSON.parse(await readFile(resolve('src/content.json'), 'utf8')).projects;
for (const project of projects) {
  if (!project.url || !(['website', 'web', 'web-app', 'webapp'].includes(project.type) || /web|browser/i.test(project.category || ''))) continue;
  const page = await readFile(resolve(root, 'works', project.slug, 'index.html'), 'utf8');
  if (!page.includes('id="preview"') || !page.includes('<iframe') || !page.includes(`src="${project.url}"`)) errors.push(`${project.slug}: missing live preview panel`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${htmlFiles.length} pages and ${links} local references at domain-root and GitHub Pages subpaths. All passed.`);
