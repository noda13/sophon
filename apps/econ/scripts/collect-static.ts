import { runCollection } from './lib/pipeline.js';

runCollection().catch(e => { console.error('Fatal:', e); process.exit(1); });
