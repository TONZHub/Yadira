import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {captureRefFromURL} from './lib/referral';
import './index.css';

// Before the first render, and before anything reads the URL. A referral
// arrives on a visit that is usually not a sign-in — someone taps a link, looks
// around, and comes back days later — so the code is parked in localStorage the
// moment they land. Running it here rather than in an effect also keeps it out
// of StrictMode's double-invoke, and strips ?ref= from the URL before the app's
// own param handling (?terms, ?premium_session) reads it.
captureRefFromURL();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
