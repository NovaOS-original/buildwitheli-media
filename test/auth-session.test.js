import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldLoadProfileForAuthEvent} from '../src/auth-session.js';

test('loads the profile for the first restored session',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('INITIAL_SESSION','user-a',null,null),true);
});

test('loads the profile after a different user signs in',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('SIGNED_IN','user-b','user-a','user-a'),true);
});

test('does not reload a loaded profile on token refresh',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('TOKEN_REFRESHED','user-a','user-a','user-a'),false);
});

test('loads the profile if a token refresh arrives before initial profile load',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('TOKEN_REFRESHED','user-a','user-a',null),true);
});

test('reloads the profile after a user record update',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('USER_UPDATED','user-a','user-a','user-a'),true);
});

test('does not load a profile for signed-out events',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('SIGNED_OUT',null,'user-a','user-a'),false);
});

test('does not duplicate profile reads for repeated sign-in events',()=>{
  assert.equal(shouldLoadProfileForAuthEvent('SIGNED_IN','user-a','user-a','user-a'),false);
});
