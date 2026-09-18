/* ============================================================
   AMAZE · auth.js  (login.html + register.html)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm)    initLogin(loginForm);
  if (registerForm) initRegister(registerForm);
});

function initLogin(form) {
  const errEl = document.getElementById('authError');
  const btn   = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

    try {
      const data = await fetchJson('api/auth_user.php?action=login', {
        method: 'POST',
        body: { email: form.email.value.trim(), password: form.password.value }
      });

      if (data.ok) {
        errEl.style.color = '#2d7d46';
        errEl.textContent = '✓ Welcome back!';
        setTimeout(() => {
          const params = new URLSearchParams(window.location.search);
          const next = params.get('next') || 'index.html';
          window.location.href = next;
        }, 500);
      } else {
        errEl.style.color = '#b45f4b';
        errEl.textContent = '✗ ' + (data.error || 'Sign in failed');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    } catch (err) {
      errEl.style.color = '#b45f4b';
      errEl.textContent = '✗ ' + (err.message || 'Network error');
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}

function initRegister(form) {
  const errEl = document.getElementById('authError');
  const btn   = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';

    const pass  = form.password.value;
    const pass2 = form.password2.value;

    if (pass !== pass2) {
      errEl.style.color = '#b45f4b';
      errEl.textContent = '✗ Passwords do not match';
      return;
    }
    if (pass.length < 6) {
      errEl.style.color = '#b45f4b';
      errEl.textContent = '✗ Password must be at least 6 characters';
      return;
    }

    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account…';

    try {
      const data = await fetchJson('api/auth_user.php?action=register', {
        method: 'POST',
        body: {
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          password: pass,
          country: (form.country && form.country.value) || 'US'
        }
      });

      if (data.ok) {
        errEl.style.color = '#2d7d46';
        errEl.textContent = '✓ Account created! Redirecting…';
        setTimeout(() => { window.location.href = 'index.html'; }, 700);
      } else {
        errEl.style.color = '#b45f4b';
        errEl.textContent = '✗ ' + (data.error || 'Registration failed');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    } catch (err) {
      errEl.style.color = '#b45f4b';
      errEl.textContent = '✗ ' + (err.message || 'Network error');
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}