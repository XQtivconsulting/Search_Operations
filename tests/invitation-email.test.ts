import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvitationEmail } from '../src/invitation-email';

const config = {RESEND_API_KEY:'synthetic', INVITATION_FROM:'Search <invites@example.com>'};
const url = 'https://app.example.com/join/synthetic-invitation';

test('unconfigured email makes no outbound request', async () => {
  const transport = (async () => { throw new Error('Must not be called'); }) as typeof fetch;
  assert.equal(await sendInvitationEmail({}, 'user@example.com', url, transport), 'not_configured');
  assert.equal(await sendInvitationEmail({RESEND_API_KEY:'synthetic'}, 'user@example.com', url, transport), 'not_configured');
});

test('invitation email uses the fixed provider endpoint and intended recipient', async () => {
  let called = false;
  const transport = (async (endpoint: any, init: any) => {
    called = true;
    assert.equal(endpoint, 'https://api.resend.com/emails');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.Authorization, 'Bearer synthetic');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.to, ['user@example.com']);
    assert.equal(body.from, config.INVITATION_FROM);
    assert.ok(body.text.includes(url));
    assert.equal(body.html, undefined);
    return Response.json({id:'test-message'});
  }) as typeof fetch;
  assert.equal(await sendInvitationEmail(config, 'user@example.com', url, transport), 'accepted');
  assert.equal(called, true);
});

test('provider failures, malformed responses and timeouts never claim delivery or leak details', async () => {
  for (const transport of [
    async () => new Response('sensitive provider response', {status:403}),
    async () => Response.json({}),
    async () => new Response('invalid JSON'),
    async () => { throw new Error('sensitive timeout details'); },
  ]) {
    assert.equal(await sendInvitationEmail(config, 'user@example.com', url, transport as typeof fetch), 'unconfirmed');
  }
});

test('account verification email uses a bounded idempotent send with explicit purpose and no secret in result',async()=>{
 const {sendAccountEmail}=await import('../src/invitation-email');let payload:any,options:any;
 const transport=async(url:any,init:any)=>{assert.equal(url,'https://api.resend.com/emails');options=init;payload=JSON.parse(init.body);return Response.json({id:'synthetic-id'});};
 const status=await sendAccountEmail({RESEND_API_KEY:'synthetic',INVITATION_FROM:'XQtiv <test@example.com>'},'new@example.com','code','123456','synthetic-message',transport as any);
 assert.equal(status,'accepted');assert.match(payload.subject,/new XQtiv sign-in email/);assert.match(payload.text,/10 minutes/);assert.equal(options.headers['Idempotency-Key'],'synthetic-message');assert.equal(options.redirect,'manual');assert.ok(options.signal);
 assert.equal(await sendAccountEmail({},'new@example.com','code','123456','id',transport as any),'not_configured');
 assert.equal(await sendAccountEmail({RESEND_API_KEY:'synthetic',INVITATION_FROM:'test@example.com'},'old@example.com','changed','new@example.com','id',(async()=>new Response('secret provider error',{status:500})) as any),'unconfirmed');
});
