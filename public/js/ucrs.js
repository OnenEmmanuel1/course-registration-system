/* UCRSystem — Client-Side JavaScript
   Handles: sidebar toggle, course selection, real-time validation, flash dismiss
*/

'use strict';

(function () {

  /* ── Sidebar Toggle ────────────────────────────────────────── */
  const toggleBtn = document.getElementById('ucrs-sidebar-toggle');
  const sidebar   = document.querySelector('.ucrs-sidebar');
  const overlay   = document.getElementById('ucrs-sidebar-overlay');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('ucrs-hidden');
    });
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.add('ucrs-hidden');
      });
    }
  }

  /* ── Mark active sidebar link ──────────────────────────────── */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.ucrs-sidebar__link').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  /* ── Course Card Selection ─────────────────────────────────── */
  document.querySelectorAll('.ucrs-course-card[data-selectable="true"]').forEach(card => {
    const cb = card.querySelector('input[type="checkbox"]');
    if (!cb) return;

    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      cb.checked = !cb.checked;
      card.classList.toggle('selected', cb.checked);
      updateCreditPreview();
    });

    cb.addEventListener('change', () => {
      card.classList.toggle('selected', cb.checked);
      updateCreditPreview();
    });
  });

  /* ── Live Credit Preview ───────────────────────────────────── */
  function updateCreditPreview() {
    const bar        = document.getElementById('ucrs-credit-preview');
    const label      = document.getElementById('ucrs-credit-label');
    const currentEl  = document.getElementById('ucrs-credit-current');
    const maxEl      = document.getElementById('ucrs-credit-max');
    const minEl      = document.getElementById('ucrs-credit-min');
    if (!bar && !label) return;

    const current  = parseInt(currentEl?.dataset.value || '0');
    const max      = parseInt(maxEl?.dataset.value || '24');

    let selected = 0;
    document.querySelectorAll('.ucrs-course-card[data-selectable="true"] input[type="checkbox"]:checked').forEach(cb => {
      selected += parseInt(cb.dataset.credits || '0');
    });

    const total = current + selected;
    const pct   = Math.min((total / max) * 100, 100);

    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.remove('ucrs-credit-bar__fill--warning', 'ucrs-credit-bar__fill--danger');
      if (pct >= 100) bar.classList.add('ucrs-credit-bar__fill--danger');
      else if (pct >= 80) bar.classList.add('ucrs-credit-bar__fill--warning');
    }

    if (label) {
      label.textContent = total + ' / ' + max + ' credit units selected';
    }
  }
  updateCreditPreview();

  /* ── Real-Time Per-Course Validation via API ───────────────── */
  const validateBtn = document.getElementById('ucrs-validate-btn');
  const submitBtn   = document.getElementById('ucrs-submit-btn');

  if (validateBtn) {
    validateBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const selectedCbs = Array.from(
        document.querySelectorAll('.ucrs-course-card[data-selectable="true"] input[type="checkbox"]:checked')
      );

      if (selectedCbs.length === 0) {
        showGlobalAlert('Please select at least one course before validating.', 'warning');
        return;
      }

      validateBtn.disabled = true;
      validateBtn.textContent = 'Validating…';

      const semester = document.getElementById('ucrs-semester')?.value || '';
      const courseIds = selectedCbs.map(cb => parseInt(cb.value));
      const resultsContainer = document.getElementById('ucrs-validation-results');

      if (resultsContainer) {
        resultsContainer.innerHTML = '<p style="color:var(--ucrs-text-muted);padding:8px 0">Checking each course…</p>';
      }

      try {
        const resp = await fetch('/api/registrations/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseIds, semester }),
        });
        const data = await resp.json();

        if (!data.ok) {
          showGlobalAlert('Validation error: ' + data.error, 'error');
          return;
        }

        renderValidationResults(data.results, resultsContainer);
      } catch (err) {
        showGlobalAlert('Network error during validation. Please try again.', 'error');
      } finally {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validate & Register';
      }
    });
  }

  function renderValidationResults(results, container) {
    if (!container) return;
    container.innerHTML = '';

    const hasFailures = results.some(r => !r.ok);
    const hasSuccess  = results.some(r => r.ok);

    const summary = document.createElement('div');
    summary.className = `ucrs-alert ucrs-alert--${hasFailures ? (hasSuccess ? 'warning' : 'error') : 'success'}`;
    summary.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        ${hasFailures && !hasSuccess
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M12 4a8 8 0 100 16A8 8 0 0012 4z"/>'
          : hasFailures
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>'}
      </svg>
      <span>
        <strong>
          ${results.filter(r=>r.ok).length} course(s) registered successfully.
          ${hasFailures ? results.filter(r=>!r.ok).length + ' course(s) failed — see details below.' : ''}
        </strong>
      </span>`;
    container.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'ucrs-validation-results';

    results.forEach(r => {
      const item = document.createElement('div');
      item.className = `ucrs-result-item ucrs-result-item--${r.ok ? 'pass' : 'fail'}`;

      let typeBadge = '';
      if (!r.ok) {
        if (r.type === 'prerequisite') {
          typeBadge = '<span class="ucrs-result-item__type-badge ucrs-type-prereq">Prerequisite Not Met</span>';
        } else if (r.type === 'credit_limit') {
          typeBadge = '<span class="ucrs-result-item__type-badge ucrs-type-credit">Credit Limit Exceeded</span>';
        } else if (r.type === 'already_registered') {
          typeBadge = '<span class="ucrs-result-item__type-badge ucrs-type-dup">Already Registered</span>';
        }
      }

      item.innerHTML = `
        <div class="ucrs-result-item__icon">${r.ok ? '✓' : '✗'}</div>
        <div class="ucrs-result-item__body">
          <div class="ucrs-result-item__course">${escHtml(r.code)} — ${escHtml(r.title)}</div>
          ${r.ok
            ? '<div class="ucrs-result-item__reason" style="color:var(--ucrs-success)">Successfully registered.</div>'
            : `<div class="ucrs-result-item__reason">${escHtml(r.reason || 'Registration failed.')}</div>${typeBadge}`}
        </div>`;
      list.appendChild(item);

      // Visually mark failing course cards
      if (!r.ok) {
        document.querySelectorAll(`.ucrs-course-card input[value="${r.courseId}"]`).forEach(cb => {
          const card = cb.closest('.ucrs-course-card');
          if (card) {
            card.style.borderColor = 'var(--ucrs-danger)';
            card.style.background = 'var(--ucrs-danger-bg)';
          }
        });
      } else {
        document.querySelectorAll(`.ucrs-course-card input[value="${r.courseId}"]`).forEach(cb => {
          cb.disabled = true;
          const card = cb.closest('.ucrs-course-card');
          if (card) {
            card.classList.remove('selected');
            card.classList.add('registered');
            card.setAttribute('data-selectable', 'false');
          }
        });
      }
    });

    container.appendChild(list);

    // Scroll to results
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Global Alert ──────────────────────────────────────────── */
  function showGlobalAlert(msg, type = 'info') {
    const typeMap = { info: 'info', warning: 'warning', error: 'error', success: 'success' };
    const cls = 'ucrs-alert--' + (typeMap[type] || 'info');

    let alertBox = document.getElementById('ucrs-global-alert');
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.id = 'ucrs-global-alert';
      const content = document.querySelector('.ucrs-content');
      if (content) content.prepend(alertBox);
    }
    alertBox.className = `ucrs-alert ${cls}`;
    alertBox.innerHTML = `<span>${escHtml(msg)}</span>`;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ── Flash Dismiss ──────────────────────────────────────────── */
  document.querySelectorAll('[data-dismiss="alert"]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.ucrs-alert')?.remove();
    });
  });

  /* ── Delete Confirm ─────────────────────────────────────────── */
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
      const msg = el.dataset.confirm || 'Are you sure?';
      if (!window.confirm(msg)) e.preventDefault();
    });
  });

  /* ── Escape HTML helper ─────────────────────────────────────── */
  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
