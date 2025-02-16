import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
const extConvert = new Map<string, string>([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
]);

app.use(
  '*',
  cors({
    origin: ['https://voskey.icalo.net'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
  }),
);

app.all('*', async (c) => {
  const { searchParams } = new URL(c.req.raw.url);
  const cond = searchParams.get('cond') || '';
  const conds = cond.split(',');
  if (!conds) {
    return new Response('Not found', {
      status: 404,
    });
  }
  const force = searchParams.get('force') === 'true';

  const cache = caches.default;
  const cachedRes = await cache.match(c.req.raw);
  if (!force && cachedRes) {
    return cachedRes;
  }

  const listResult = await c.env.IMAGE_BUCKET.list();
  const objects = listResult.objects as R2Object[];

  if (objects.length === 0) {
    return new Response('Not found', {
      status: 404,
    });
  }

  const randomIndex = Math.floor(Math.random() * objects.length);
  const imageObj = objects[randomIndex];

  const splitted = imageObj.key.split('.');
  const ext = splitted[splitted.length - 1];

  const obj = await c.env.IMAGE_BUCKET.get(imageObj.key);

  // 流石に毎回変わると遅すぎるので、
  // 5分に1回キャッシュの有効期限が切れて画像が変わる仕組みにした
  const res = new Response(obj.body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': extConvert.get(ext) ?? 'application/octet-stream',
    },
  });
  await cache.put(c.req.raw, res.clone());
  return res;
});

export default app;
