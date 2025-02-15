export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const cond = searchParams.get('cond') || '';
    const conds = cond.split(',');
    if (!conds) {
      return new Response('Not found', {
        status: 404,
      });
    }
    const force = searchParams.get('force') === 'true';

    const cache = caches.default;
    const cachedRes = await cache.match(request);
    if (!force && cachedRes) {
      return cachedRes;
    }

    const listResult = await env.IMAGE_BUCKET.list();
    const objects = listResult.objects as R2Object[];

    if (objects.length === 0) {
      return new Response('Not found', {
        status: 404,
      });
    }

    const randomIndex = Math.floor(Math.random() * objects.length);
    const imageObj = objects[randomIndex];

    const extConvert = new Map<string, string>([
      ['jpg', 'image/jpeg'],
      ['jpeg', 'image/jpeg'],
      ['png', 'image/png'],
      ['webp', 'image/webp'],
      ['gif', 'image/gif'],
    ]);

    const splitted = imageObj.key.split('.');
    const ext = splitted[splitted.length - 1];

    const obj = await env.IMAGE_BUCKET.get(imageObj.key);

    // 流石に毎回変わると遅すぎるので、
    // 5分に1回キャッシュの有効期限が切れて画像が変わる仕組みにした
    const res = new Response(obj.body, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': extConvert.get(ext) ?? 'application/octet-stream',
      },
    });
    ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  },
} satisfies ExportedHandler<Env>;
