import { MySQLStore } from '../src/store.js';
const store = new MySQLStore();
try { await store.init(); console.log('Đã khởi tạo schema MySQL.'); } finally { await store.close(); }
