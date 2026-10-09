// "CV": a page of its own. Import a CV, edit it (content, design, document settings), prepare the cover letter.
// Everything is saved as you type; the PDFs are always generated from here, for each offer, in the offer sheet.
import { S } from '../main.js';
import { cvStudioSection, bindCvStudio } from './cv-studio.js';
import { update, setSaveIndicator, bindUpload } from '../profile-store.js';
import { html, mount, longDate } from '../lib.js';

export function renderCv(view) {
  const p = S.profile;
  mount(
    view,
    html`<div class="page-head">
        <div><h1 class="page-title">CV</h1><p class="page-sub">Importe ton CV, modifie-le, choisis son design et prépare ta lettre de motivation. Tout part en PDF.</p></div>
        <span class="saved" id="saved"></span>
      </div>

      <section>
        ${p.cvFile
          ? html`<div class="card row wrap">
              <div class="grow">
                <div style="font-weight:600">${p.cvFile.name}</div>
                <div class="small muted">Ton CV importé${p.cvFile.uploadedAt ? `, le ${longDate(p.cvFile.uploadedAt)}` : ''}</div>
              </div>
              <a class="btn btn-secondary btn-sm" href="/api/profile/cv" target="_blank">Ouvrir</a>
              <button class="btn btn-secondary btn-sm" id="replace">Remplacer</button>
              ${S.secrets.aiEnabled ? html`<button class="btn btn-primary btn-sm" id="ai-parse" data-busy="Lecture…">Remplir avec Claude</button>` : ''}
            </div>`
          : html`<div class="import-bar" id="drop" tabindex="0" role="button">
              <div class="grow"><b>Tu as déjà un CV ?</b><small>Glisse un PDF ou un fichier Word ici, ou clique : l'app lit ton parcours et tes compétences. Sinon, remplis simplement les rubriques ci-dessous.</small></div>
              <span class="btn btn-secondary btn-sm">Importer</span>
            </div>`}
        <input type="file" id="file" accept=".pdf,.docx" hidden>
      </section>

      ${cvStudioSection(p)}

      ${p.cvFile?.type === 'docx'
        ? html`<section class="section">
            <div class="section-head"><h2 class="section-title">Ton fichier Word</h2></div>
            <div class="card">
              <p class="small muted" style="margin-bottom:16px">Pour générer tes CV directement depuis ton fichier Word, en gardant sa mise en page.</p>
              <div class="grid-2">
                <label class="field"><span class="label">Texte du titre à remplacer</span><input class="input" id="docx-title" value="${p.docx.titleText}" placeholder="Tel qu'écrit dans ton CV"></label>
                <label class="field"><span class="label">Rubrique où ajouter les compétences</span><input class="input" id="docx-anchor" value="${p.docx.skillsAnchor}" placeholder="Ex. Cybersécurité"></label>
              </div>
              <p class="hint">La conversion en PDF utilise Microsoft Word ou LibreOffice s'ils sont installés.</p>
            </div>
          </section>`
        : ''}`,
  );

  setSaveIndicator(view.querySelector('#saved'));
  bindUpload(view, () => renderCv(view));
  bindCvStudio(view, { update });
  view.querySelector('#docx-title')?.addEventListener('input', (e) => update({ docx: { ...S.profile.docx, titleText: e.target.value } }));
  view.querySelector('#docx-anchor')?.addEventListener('input', (e) => update({ docx: { ...S.profile.docx, skillsAnchor: e.target.value } }));
}
