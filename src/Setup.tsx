import React, {useState} from 'react';

export function Setup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{url:string;emailStatus:string}|null>(null);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/setup', {
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${fields.get('key')}`},
        body:JSON.stringify({tenant:'xqtiv',email:fields.get('email'),name:fields.get('name')}),
      });
      const data = await response.json() as any;
      if (!response.ok) throw new Error(response.status === 404
        ? 'Setup is not enabled, or the temporary setup key does not match.'
        : data.error || 'Setup could not be completed.');
      form.reset();
      setResult({url:`/join/${data.invitation}`,emailStatus:data.emailStatus});
    } catch (error:any) {setError(error.message || 'Setup could not be completed.');}
    finally {setBusy(false);}
  }
  return <main className="login">
    <section className="login-story">
      <div className="brand">XQtiv Search Operations</div>
      <h1>Set up your workspace.</h1>
      <p>Create the first administrator. You can invite your team after signing in.</p>
    </section>
    <section className="login-form">
      <h2>{result ? 'Your invitation is ready' : 'First administrator'}</h2>
      {result ? <>
        <p>{result.emailStatus === 'accepted' ? 'Your invitation was submitted for email delivery. You can also continue here.' : 'Continue below to choose your password. Email delivery was not confirmed.'}</p>
        <p>Delete the temporary SETUP_KEY secret in Cloudflare, then continue.</p>
        <a className="primary" href={result.url}>Choose my password</a>
        <p className="fine">Keep this page open until you continue. This invitation is private and expires in seven days.</p>
      </> : <>
        <p>Enter the temporary SETUP_KEY you saved as a Cloudflare Worker secret. This is separate from your email API key and the password you will choose next.</p>
        <form onSubmit={submit}>
          <label>Full name<input name="name" required maxLength={100} autoComplete="name" /></label>
          <label>Work email<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          <label>Temporary setup key<input name="key" type="password" required autoComplete="off" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Creating invitation…' : 'Create administrator invitation'}</button>
        </form>
        <p className="fine">Already have an account? <a href="/">Sign in</a></p>
      </>}
    </section>
  </main>;
}
