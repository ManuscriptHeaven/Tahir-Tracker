export default {
  async fetch(request: Request, env: { ASSETS?: { fetch: (req: Request) => Promise<Response> } }): Promise<Response> {
    if (env?.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Tahir Tracker static assets worker ready', { status: 200 });
  },
};
