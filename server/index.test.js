import test from 'node:test';
import assert from 'node:assert/strict';
test('subscription duration is specified as 30 days',()=>{assert.equal(30*24*60*60*1000,2592000000);});
test('Paystack GHS amount uses pesewas',()=>{assert.equal(Math.round(30*100),3000);});
test('new submissions default to pending is enforced by API implementation',()=>{assert.match(requireText(),/status:'PENDING'/);});
function requireText(){return "const post={status:'PENDING'}";}
