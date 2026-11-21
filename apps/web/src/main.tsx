import { encodePortabilityFixture } from '@rulecraft/simulation';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browserDraftStore } from './draft-store';
import './styles.css';

const fixture = encodePortabilityFixture(42);

function App() {
  const [pending, setPending] = useState(true);
  const [status, setStatus] = useState('Checking this device for a saved fixture…');

  useEffect(() => {
    async function restoreFixture() {
      try {
        const savedFixture = await browserDraftStore.load();
        if (savedFixture === fixture) {
          setStatus('Fixture restored from this device.');
        } else if (savedFixture === null) {
          setStatus('Save the fixture and reload this page to check local storage.');
        } else {
          setStatus('The saved fixture is out of date. Save again to replace it.');
        }
      } catch {
        setStatus('Could not read local storage on this device.');
      } finally {
        setPending(false);
      }
    }

    void restoreFixture();
  }, []);

  async function saveFixture() {
    setPending(true);
    try {
      await browserDraftStore.save(fixture);
      setStatus('Fixture saved. Reload this page to check that it restores.');
    } catch {
      setStatus('Could not save the fixture on this device.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Rulecraft</h1>
      <section aria-labelledby="fixture-heading">
        <h2 id="fixture-heading">Portability check</h2>
        <code>{fixture}</code>
        <button type="button" disabled={pending} onClick={saveFixture}>Save fixture</button>
        <p role="status">{status}</p>
      </section>
    </main>
  );
}

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Rulecraft root element is missing.');
}
createRoot(root).render(<App />);
