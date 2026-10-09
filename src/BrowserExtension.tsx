import React from 'react';
import {DownloadSimple} from '@phosphor-icons/react';
import './browser-extension.css';

export function BrowserExtension(){return <section className="panel browser-extension">
  <div className="section-head"><h2>XRP Profile Mapper</h2><a className="primary extension-download" href="/downloads/xrp-profile-mapper.zip?v=2.0.5" download><DownloadSimple size={18}/> Download extension</a></div>
  <p className="muted">Chrome &amp; Microsoft Edge · Version 2.0.5</p>
  <h3>Install</h3>
  <ol><li>Download the ZIP and extract it into a folder you will keep.</li><li>Open <code>chrome://extensions</code> in Chrome or <code>edge://extensions</code> in Edge.</li><li>Turn on <strong>Developer mode</strong>, select <strong>Load unpacked</strong>, and choose the extracted folder containing <code>manifest.json</code>.</li><li>Pin <strong>XRP Profile Mapper</strong> from your browser’s Extensions menu.</li></ol>
  <h3>Import a profile</h3>
  <ol><li>Keep XRP signed in. Open a LinkedIn profile, open the extension, and select <strong>Connect to XRP</strong>.</li><li>Choose <strong>Into a search</strong>, type a search name or XQtiv Search ID, and select the matching search. Alternatively, choose <strong>Candidate directory only</strong>.</li><li>Select <strong>Capture LinkedIn profile</strong>. Duplicate matches appear automatically. Expand <strong>Profile details</strong> to check or correct captured information.</li><li>Select <strong>Import</strong>. New search mappings start in Draft; existing candidates and companies are reused.</li></ol>
  <details><summary>Update an existing installation</summary><p>Replace the files in the original folder with the new ZIP contents. Open your browser’s Extensions page, select Reload for XRP Profile Mapper, and refresh the LinkedIn and XRP tabs.</p></details>
  <details><summary>Connection and permissions</summary><p>Imports use your signed-in XRP account and its permissions. Only eligible open searches appear. If connection fails, refresh XRP and reconnect. After switching accounts or workspaces, reconnect the extension.</p></details>
</section>}
