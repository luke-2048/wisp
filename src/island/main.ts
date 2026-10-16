import { it } from '../i18n/it';
import './island.css';

// Step 0 placeholder: proves the window and the build pipeline work.
// The real island and Wisp arrive in step 1.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = `<div class="placeholder">${it.appName}</div>`;
}
