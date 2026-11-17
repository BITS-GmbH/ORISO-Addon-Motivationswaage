// Local preview of the UI without ORISO: `npm run preview`, then open http://localhost:5179.
// Client and counsellor view side by side on one in-memory API; React comes from esm.sh.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { UI_FILES } from '../src/app.mjs';

const port = Number(process.env.PORT ?? 5179);
const page = new URL('./preview.html', import.meta.url);

createServer(async (req, res) => {
	const path = new URL(req.url, 'http://localhost').pathname;
	if (Object.hasOwn(UI_FILES, path)) {
		res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
		return res.end(await readFile(UI_FILES[path]));
	}
	if (path === '/') {
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
		return res.end(await readFile(page));
	}
	res.writeHead(404);
	res.end();
}).listen(port, () => console.log(`preview on http://localhost:${port}`));
