import assert from 'node:assert/strict';
import {fixture} from './check-cursor.mjs';
const dense=fixture();
for(let ms=0;ms<=2400;ms+=16){dense.move(ms,(ms/16)%2?1100:100);dense.step(ms);}
const afterInput=dense.clears;
for(let ms=2416;ms<=3328;ms+=16)dense.step(ms);
assert.equal(dense.clears,afterInput,'Dense fluid is not hard-cleared after the old 900ms timeout');
assert.ok(dense.pending.size>0,'Dense fluid continues advecting and decaying while potentially visible');
for(let ms=3344;ms<=6000;ms+=16)dense.step(ms);
assert.equal(dense.pending.size,0,'Even dense strokes eventually decay and release rendering resources');

assert.ok(!dense.windowHandlers['portfolio-guide'],'Removed blob has no event listeners in the fluid renderer');
console.log('Cursor fluid decays naturally and the blob integration is fully removed.');
