import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Reproduce the browser's pointer/click ordering without requiring a mouse.
const handlers = {}, buttonHandlers = {}, classes = new Set(), attributes = {};
let tapMode = true;
const menu = {
  classList: { toggle: (key, value) => value ? classes.add(key) : classes.delete(key), contains: key => classes.has(key) },
  contains: () => false,
  getBoundingClientRect: () => ({ right: 84 })
};
const toggle = {
  setAttribute: (key, value) => { attributes[key] = value; },
  addEventListener: (type, handler) => { buttonHandlers[type] = handler; },
  contains: target => target === toggle
};
const document = {
  querySelector: selector => selector === '.side-nav' ? menu : toggle,
  querySelectorAll: () => [], activeElement: null,
  addEventListener: (type, handler) => { handlers[type] = handler; },
  documentElement: { addEventListener: (type, handler) => { handlers[type] = handler; } }
};
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8').split('const reel =')[0];
vm.runInNewContext(source, { document, matchMedia: () => ({ matches: tapMode }) });

handlers.pointermove({ pointerType: 'mouse', clientX: 30 });
assert.equal(classes.has('is-visible'), false, 'Mobile hover must not pre-open the toggle');
handlers.pointerdown({ target: toggle });
buttonHandlers.click();
assert.equal(attributes['aria-expanded'], 'true', 'One tap opens navigation');
handlers.pointerleave({ pointerType: 'touch' });
handlers.pointerleave({ pointerType: 'mouse' });
assert.equal(attributes['aria-expanded'], 'true', 'Touch release must not close navigation');
buttonHandlers.click();
assert.equal(attributes['aria-expanded'], 'false', 'Second tap closes navigation');
buttonHandlers.click();
handlers.pointerdown({ target: {} });
assert.equal(attributes['aria-expanded'], 'false', 'Tap outside closes navigation');
tapMode = false;
handlers.pointermove({ pointerType: 'mouse', clientX: 30 });
assert.equal(attributes['aria-expanded'], 'true', 'Desktop edge reveal remains available');
handlers.pointermove({ pointerType: 'mouse', clientX: 240 });
assert.equal(attributes['aria-expanded'], 'false', 'Desktop navigation hides away from the edge');
console.log('Mobile toggle/release/outside-tap and desktop edge-navigation checks passed.');
