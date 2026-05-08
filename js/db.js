/**
 * db.js — LocalStorage-based "database" for Mark's Fade
 * Handles users and customer records (appointments / clients)
 */

const DB = (() => {
  const USERS_KEY   = 'mf_users';
  const RECORDS_KEY = 'mf_records';
  const SESSION_KEY = 'mf_session';

  /* ---- helpers ---- */
  const getAll = key => JSON.parse(localStorage.getItem(key) || '[]');
  const setAll = (key, data) => localStorage.setItem(key, JSON.stringify(data));
  const genId  = () => '_' + Math.random().toString(36).slice(2, 10);
  const now    = () => new Date().toISOString();

  /* ====== USERS ====== */
  const users = {
    getAll: () => getAll(USERS_KEY),

    findByUsername: username =>
      getAll(USERS_KEY).find(u => u.username.toLowerCase() === username.toLowerCase()),

    findByEmail: email =>
      getAll(USERS_KEY).find(u => u.email.toLowerCase() === email.toLowerCase()),

    create({ firstName, lastName, email, phone, username, password }) {
      const list = getAll(USERS_KEY);
      if (users.findByUsername(username)) return { ok: false, error: 'Username already taken.' };
      if (users.findByEmail(email))       return { ok: false, error: 'Email already registered.' };
      const user = { id: genId(), firstName, lastName, email, phone, username, password, createdAt: now() };
      list.push(user);
      setAll(USERS_KEY, list);
      return { ok: true, user };
    },

    authenticate(username, password) {
      const user = users.findByUsername(username);
      if (!user)                 return { ok: false, error: 'Username not found.' };
      if (user.password !== password) return { ok: false, error: 'Incorrect password.' };
      return { ok: true, user };
    }
  };

  /* ====== SESSION ====== */
  const session = {
    set:   user => localStorage.setItem(SESSION_KEY, JSON.stringify(user)),
    get:   ()   => JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'),
    clear: ()   => localStorage.removeItem(SESSION_KEY),
    isLoggedIn: () => !!session.get()
  };

  /* ====== RECORDS ====== */
  const records = {
    getAll: () => getAll(RECORDS_KEY),

    getByUser: userId => getAll(RECORDS_KEY).filter(r => r.userId === userId),

    create({ userId, clientName, service, date, time, phone, notes, status }) {
      const list = getAll(RECORDS_KEY);
      const record = { id: genId(), userId, clientName, service, date, time, phone, notes, status: status || 'Scheduled', createdAt: now() };
      list.push(record);
      setAll(RECORDS_KEY, list);
      return { ok: true, record };
    },

    update(id, updates) {
      const list = getAll(RECORDS_KEY);
      const idx  = list.findIndex(r => r.id === id);
      if (idx === -1) return { ok: false };
      list[idx] = { ...list[idx], ...updates, updatedAt: now() };
      setAll(RECORDS_KEY, list);
      return { ok: true, record: list[idx] };
    },

    delete(id) {
      const list = getAll(RECORDS_KEY).filter(r => r.id !== id);
      setAll(RECORDS_KEY, list);
      return { ok: true };
    },

    search(userId, query) {
      const q = query.toLowerCase();
      return records.getByUser(userId).filter(r =>
        r.clientName.toLowerCase().includes(q) ||
        r.service.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }
  };

  /* ====== PASSWORD RESET TOKENS ====== */
  const RESET_KEY = 'mf_reset_tokens';

  const resetTokens = {
    create(email) {
      const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const expiry = Date.now() + 1000 * 60 * 30; // 30 minutes
      const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
      tokens[token] = { email: email.toLowerCase(), expiry };
      localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
      return token;
    },

    verify(token) {
      const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
      const entry = tokens[token];
      if (!entry) return { ok: false, error: 'Invalid or expired reset link.' };
      if (Date.now() > entry.expiry) {
        delete tokens[token];
        localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
        return { ok: false, error: 'Reset link has expired. Please request a new one.' };
      }
      return { ok: true, email: entry.email };
    },

    consume(token) {
      const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
      delete tokens[token];
      localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
    }
  };

  /* ====== USERS — reset password ====== */
  users.resetPassword = function(email, newPassword) {
    const list = getAll(USERS_KEY);
    const idx  = list.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return { ok: false, error: 'User not found.' };
    list[idx].password = newPassword;
    list[idx].updatedAt = now();
    setAll(USERS_KEY, list);
    return { ok: true };
  };

  return { users, session, records, resetTokens };
})();