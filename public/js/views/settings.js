import { S } from '../main.js';
import { html, raw, mount, api, fail, toast, busy } from '../lib.js';

const SERVICES = [
  ['gmail', 'Gmail'],
  ['outlook365', 'Outlook / Hotmail'],
  ['custom', 'Autre (SMTP)'],
];

const VARIABLES = ['contact', 'poste', 'entreprise', 'titre', 'resume', 'nom', 'email', 'telephone'];

export function renderSettings(view) {
  const { smtp } = S.secrets;
  const st = S.settings;
  mount(
    view,
    html`<div class="page-head"><div><h1 class="page-title">Réglages</h1></div></div>

      <section id="mobile-section" hidden></section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Adresse d'envoi</h2></div>
        <form class="card" id="smtp">
          <div class="grid-2">
            <label class="field"><span class="label">Service</span>
              <select class="select" name="service">${SERVICES.map(([v, l]) => html`<option value="${v}" ${smtp.service === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
            <label class="field"><span class="label">Adresse e-mail</span><input class="input" name="user" type="email" value="${smtp.user}" autocomplete="username"></label>
          </div>
          <div class="grid-2" id="custom" style="margin-top:16px" ${smtp.service === 'custom' ? '' : raw('hidden')}>
            <label class="field"><span class="label">Serveur SMTP</span><input class="input" name="host" value="${smtp.host}" placeholder="smtp.exemple.fr"></label>
            <label class="field"><span class="label">Port</span><input class="input" name="port" type="number" value="${smtp.port}"></label>
          </div>
          <label class="field" style="margin-top:16px"><span class="label">Mot de passe d'application</span>
            <input class="input" name="pass" type="password" autocomplete="current-password" placeholder="${smtp.hasPass ? 'Enregistré · laisse vide pour le conserver' : ''}"></label>
          <p class="hint">Avec Gmail, crée un mot de passe d'application dans ton compte Google (Sécurité › Validation en deux étapes › Mots de passe des applications). Il reste stocké sur cet ordinateur, dans data/secrets.json.</p>
          <div class="form-foot">
            <button type="button" class="btn btn-secondary" id="test" data-busy="Test…" ${smtp.hasPass ? '' : raw('disabled')}>Tester</button>
            <button class="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Modèle d'e-mail</h2></div>
        <form class="card" id="template">
          <label class="field"><span class="label">Objet</span><input class="input" name="emailSubject" value="${st.emailSubject}"></label>
          <label class="field"><span class="label">Message</span><textarea class="textarea" name="emailTemplate" rows="12">${st.emailTemplate}</textarea></label>
          <div class="chips" style="margin-top:10px">${VARIABLES.map((v) => html`<button type="button" class="chip suggest" data-var="${v}">{{${v}}}</button>`)}</div>
          <p class="hint">Clique sur une variable pour l'insérer. Elle est remplacée par les informations de l'offre et de ton profil. Avec Claude, un message sur mesure est proposé à la place.</p>
          <div class="form-foot"><button class="btn btn-primary">Enregistrer</button></div>
        </form>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Relances</h2></div>
        <form class="card row wrap" id="followup">
          <span class="grow">Me proposer une relance après</span>
          <input class="input" name="followUpDays" type="number" min="1" max="60" value="${st.followUpDays}" style="width:80px">
          <span>jours sans réponse</span>
          <button class="btn btn-secondary btn-sm">Enregistrer</button>
        </form>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Claude</h2><span class="section-note">${S.secrets.aiEnabled ? 'Activé' : 'Facultatif'}</span></div>
        <form class="card" id="ai">
          <p class="small muted" style="margin-bottom:16px">Avec une clé API, Claude lit chaque offre, propose un titre et un résumé de CV ciblés, rédige l'e-mail et structure ton CV importé. Sans clé, tout le reste fonctionne.</p>
          <label class="field"><span class="label">Clé API</span>
            <input class="input" name="anthropicKey" type="password" autocomplete="off" placeholder="${S.secrets.hasAnthropicKey ? 'Enregistrée · colle une nouvelle clé pour la remplacer' : 'sk-ant-…'}"></label>
          <p class="hint">Crée une clé sur console.anthropic.com. Elle reste sur cet ordinateur.</p>
          <div class="form-foot">
            ${S.secrets.hasAnthropicKey ? html`<button type="button" class="btn btn-plain small" id="ai-remove">Retirer la clé</button>` : ''}
            <button class="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Données</h2></div>
        <div class="card row wrap">
          <div class="grow"><div style="font-weight:500">Exporter tes candidatures</div><div class="small muted">Fichier Excel avec statut, correspondance, contacts et notes.</div></div>
          <a class="btn btn-secondary btn-sm" href="/api/export.xlsx" download>Exporter</a>
        </div>
      </section>`,
  );

  renderPhone(view.querySelector('#mobile-section'));

  const saveSettings = async (body, message = 'Enregistré') => {
    const res = await api('/settings', { method: 'PUT', body });
    S.settings = res.settings;
    S.secrets = res.secrets;
    toast(message);
  };

  const smtpForm = view.querySelector('#smtp');
  smtpForm.service.addEventListener('change', (e) => (view.querySelector('#custom').hidden = e.target.value !== 'custom'));
  smtpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const smtp = Object.fromEntries(new FormData(smtpForm));
    try {
      await saveSettings({ smtp });
      renderSettings(view);
    } catch (err) {
      fail(err);
    }
  });
  view.querySelector('#test').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      try {
        await api('/settings/test-smtp', { method: 'POST' });
        toast('Connexion réussie');
      } catch (err) {
        fail(err);
      }
    }),
  );

  const tpl = view.querySelector('#template');
  let lastField = tpl.emailTemplate;
  [tpl.emailSubject, tpl.emailTemplate].forEach((f) => f.addEventListener('focus', () => (lastField = f)));
  tpl.querySelectorAll('[data-var]').forEach((b) =>
    b.addEventListener('click', () => {
      const token = `{{${b.dataset.var}}}`;
      const { selectionStart: s = lastField.value.length, selectionEnd: end = s } = lastField;
      lastField.setRangeText(token, s, end, 'end');
      lastField.focus();
    }),
  );
  tpl.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings({ emailSubject: tpl.emailSubject.value, emailTemplate: tpl.emailTemplate.value }).catch(fail);
  });

  const fu = view.querySelector('#followup');
  fu.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings({ followUpDays: fu.followUpDays.value }).catch(fail);
  });

  const aiForm = view.querySelector('#ai');
  aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!aiForm.anthropicKey.value.trim()) return;
    try {
      await saveSettings({ anthropicKey: aiForm.anthropicKey.value }, 'Clé enregistrée');
      renderSettings(view);
    } catch (err) {
      fail(err);
    }
  });
  view.querySelector('#ai-remove')?.addEventListener('click', async () => {
    try {
      await saveSettings({ anthropicKey: '' }, 'Clé retirée');
      renderSettings(view);
    } catch (err) {
      fail(err);
    }
  });
}

// ---------- Sur ton téléphone ----------
// Opens the app to the local network, behind a 6-digit code (server/lib/remote.js). Only shown on the computer
// that runs Mitady: from a phone the server answers 403 and the card stays hidden.

async function renderPhone(sec) {
  let info;
  try {
    info = await api('/mobile');
  } catch {
    return;
  }
  const draw = (i) => {
    sec.hidden = false;
    const pin = i.pin ? `${i.pin.slice(0, 3)} ${i.pin.slice(3)}` : '';
    mount(
      sec,
      html`<div class="section-head"><h2 class="section-title">Sur ton téléphone</h2><span class="section-note">${i.enabled ? 'Activé' : 'Désactivé'}</span></div>
        <div class="card phone-card">
          ${i.enabled
            ? html`${i.qr ? html`<div class="phone-qr" aria-label="QR code pour ouvrir Mitady sur le téléphone">${raw(i.qr)}</div>` : ''}
              <div class="phone-body">
                <ol class="phone-steps">
                  <li>Connecte ton téléphone au <b>même Wi-Fi</b> que cet ordinateur, puis ${i.qr ? html`<b>scanne le QR code</b> avec l'appareil photo` : 'ouvre l\'adresse ci-dessous'}.</li>
                  <li>Sur iPhone, dans Safari : <b>Partager › Sur l'écran d'accueil</b>. Mitady devient une appli, avec son icône.</li>
                </ol>
                ${i.urls.length
                  ? html`<div class="phone-urls">${i.urls.map((u) => html`<div class="phone-url"><div class="grow"><code>${u.url}</code><small>${u.label}</small></div><button type="button" class="btn btn-secondary btn-sm" data-copy="${u.url}">Copier</button></div>`)}</div>`
                  : html`<p class="hint">Aucune adresse réseau trouvée : connecte cet ordinateur à un Wi-Fi ou à un câble réseau.</p>`}
                <div class="phone-pin"><span class="label">Code à saisir sur le téléphone</span><b>${pin}</b></div>
                <p class="hint">L'ordinateur doit rester allumé avec Mitady lancé. Le téléphone parle directement à ton ordinateur : rien ne passe par Internet. Le code est demandé une fois par téléphone.</p>
                <div class="form-foot"><button type="button" class="btn btn-secondary btn-sm" id="phone-regen">Changer le code</button>${i.fromSettings ? html`<button type="button" class="btn btn-plain small" id="phone-off">Désactiver</button>` : html`<span class="hint">Ouvert par HOST au lancement : relance sans HOST pour le refermer.</span>`}</div>
              </div>`
            : html`<div class="phone-body">
                <p style="margin-bottom:6px"><b>Retrouve Mitady sur ton iPhone ou ton Android.</b></p>
                <p class="small muted">Un iPhone ne peut pas faire tourner Mitady lui-même : l'appli reste sur cet ordinateur, et le téléphone l'affiche à distance, tant que les deux sont sur le même Wi-Fi. L'accès est protégé par un code à 6 chiffres.</p>
                <div class="form-foot"><button type="button" class="btn btn-primary" id="phone-on">Activer l'accès téléphone</button></div>
              </div>`}
        </div>`,
    );
    sec.querySelector('#phone-on')?.addEventListener('click', (e) => busy(e.currentTarget, () => change('/mobile/enable', 'Accès téléphone activé')));
    sec.querySelector('#phone-off')?.addEventListener('click', () => change('/mobile/disable', 'Accès téléphone désactivé'));
    sec.querySelector('#phone-regen')?.addEventListener('click', () => change('/mobile/regenerate', 'Nouveau code : les téléphones doivent le ressaisir'));
    sec.querySelectorAll('[data-copy]').forEach((b) =>
      b.addEventListener('click', async () => {
        await navigator.clipboard?.writeText(b.dataset.copy).catch(() => {});
        toast('Adresse copiée');
      }),
    );
  };
  const change = async (path, message) => {
    try {
      draw(await api(path, { method: 'POST' }));
      toast(message);
      // the server re-opens its door a moment after answering: read the addresses once it is done
      setTimeout(() => api('/mobile').then(draw).catch(() => {}), 900);
    } catch (err) {
      fail(err);
    }
  };
  draw(info);
}
