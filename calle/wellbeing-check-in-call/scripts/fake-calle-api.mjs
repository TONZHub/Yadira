// A stand-in CALL-E Developer API, so the whole route can be exercised without
// the live service. Answers the documented shapes.
import http from 'http';

const scenario = process.argv[2] || 'calm';

const SCENARIOS = {
  calm: {
    structured: { answered: 'recipient', mood: 'peaceful', distress: 'none' },
    said: ['Oh, I am quite well thank you. Just having my tea.'],
  },
  distress: {
    structured: { answered: 'recipient', mood: 'anxious', distress: 'urgent', distress_detail: 'She said she had fallen this morning.' },
    said: ['I fell this morning and I cannot get up'],
  },
  // The safety case: CALL-E says all is well, the words say otherwise.
  vendorMissedIt: {
    structured: { answered: 'recipient', mood: 'peaceful', distress: 'none' },
    said: ['Please help me'],
  },
  lucid: {
    structured: { answered: 'recipient', mood: 'peaceful', distress: 'none' },
    said: ['Yadira, I know I have dementia'],
  },
};

const { structured, said } = SCENARIOS[scenario] || SCENARIOS.calm;

http
  .createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/v1/calls') {
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        console.log('[fake CALL-E] POST /v1/calls');
        console.log('  auth:', req.headers.authorization);
        console.log('  idempotency-key:', req.headers['idempotency-key']);
        console.log('  recipient:', JSON.stringify(body.recipients?.[0]));
        console.log('  schema fields:', Object.keys(body.recipient_result_schema?.properties || {}).join(', '));
        console.log('  task starts:', String(body.task).split('\n')[0].slice(0, 80));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ call_id: 'call_fake_1', status: 'queued' }));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/v1/calls/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'completed',
            task_completed: true,
            completion_confidence: { score: 0.9, label: 'high' },
            evidence: ['fake evidence'],
            recipients: [
              {
                structured_result: structured,
                attempts: [
                  {
                    transcript_turns: [
                      { offset_seconds: 0, speaker: 'bot', text: 'Hello Eleanor, it is Yadira.' },
                      ...said.map((text, i) => ({ offset_seconds: 4 + i, speaker: 'user', text })),
                    ],
                  },
                ],
              },
            ],
          })
        );
        return;
      }
      res.writeHead(404).end('{}');
    });
  })
  .listen(9099, '127.0.0.1', () => console.log(`[fake CALL-E] listening, scenario=${scenario}`));
