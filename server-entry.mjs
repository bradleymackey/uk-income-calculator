import { createServer } from 'node:http';
import handler from './dist/server/server.js';

const port = parseInt(process.env.PORT || '3000', 10);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value)
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const body =
    req.method !== 'GET' && req.method !== 'HEAD'
      ? await new Promise((resolve) => {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks)));
        })
      : undefined;

  const request = new Request(url, {
    method: req.method,
    headers,
    body,
  });

  const response = await handler.fetch(request);

  res.writeHead(
    response.status,
    Object.fromEntries(response.headers.entries()),
  );
  const responseBody = response.body;
  if (responseBody) {
    const reader = responseBody.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      await pump();
    };
    await pump();
  } else {
    res.end();
  }
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
