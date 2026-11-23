# Oscar Molina — portfolio

A red, panel-based portfolio using the supplied Coluna Rounded font and monogram assets. Built as a small static site for GitHub Pages, without runtime dependencies.

## Local preview

```sh
npm run dev
```

Open http://127.0.0.1:4193. Changes under `src/` rebuild automatically; refresh the browser to see them.

```sh
npm run build
npm run check
```

## Content

Edit `src/content.json` for the bio, contact email, skills, experience, and project collections. Content is based on the supplied résumé; the dated school-year wording is omitted. The résumé image and phone number are not included in the site or repository.

The three collections and their artwork are explicitly marked as placeholders. Replace the project content and artwork in `scripts/build.mjs` when real projects are selected. The original branding files are preserved in the parent workspace; the site uses copies under `src/assets/`.

## Pages

- `/` — five full-height panels with native scroll snapping, clickable position indicators, and keyboard paging.
- `/about/` — background, experience, and skills.
- `/works/` — filterable project collections.
- `/works/graphic-design/`, `/works/photo-and-film/`, `/works/design-and-build/` — placeholder project subpages.

All navigation and assets use relative paths so the site works both at a domain root and under a GitHub Pages repository path. The navigation remains on the left, expands on hover or keyboard focus, and has a toggle for touch. Reduced-motion preferences are respected.

## Hosting status

Source repository: https://github.com/Infekted11/oscar-molina-portfolio

Reserved Netlify project: https://app.netlify.com/projects/oscar-molina-portfolio

**Unpublished.** The Netlify project is empty and is not connected to Git continuous deployment. `.netlify/` is ignored. The Netlify build command deliberately blocks publication. GitHub Pages has a manual-only workflow, so ordinary pushes cannot publish it.

When publication is authorized, set the repository's **Settings → Pages → Source** to **GitHub Actions**, then run **Publish to GitHub Pages** from the Actions tab. See the [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The intended address is `https://infekted11.github.io/oscar-molina-portfolio/`.

The supplied font and branding remain their respective owner's assets; no license to redistribute them is asserted by this repository.
