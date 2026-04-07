import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const BOT_RE = /(bot|crawler|spider|preview|slackbot|discordbot|telegrambot|whatsapp|skypeuripreview|facebookexternalhit|linkedinbot|twitterbot|applebot|googlebot|bingbot|embedly|mattermost|mastodon|vkshare|quora link preview|pinterest|yandex|redditbot|developers\.google\.com)/i;

function secureNoStore(response: NextResponse) {
  response.headers.set('cache-control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('pragma', 'no-cache');
  response.headers.set('expires', '0');
  response.headers.set('x-robots-tag', 'noindex, noarchive, nosnippet, noimageindex');
  response.headers.set('referrer-policy', 'no-referrer');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get('user-agent') || '';
  const purpose = request.headers.get('purpose') || request.headers.get('x-purpose') || '';
  const secPurpose = request.headers.get('sec-purpose') || '';
  const prefetch = request.headers.get('x-moz') || '';

  if (pathname.startsWith('/s/')) {
    if (
      BOT_RE.test(ua) ||
      /prefetch/i.test(purpose) ||
      /prefetch/i.test(secPurpose) ||
      /prefetch/i.test(prefetch)
    ) {
      return secureNoStore(
        new NextResponse('Preview blocked', {
          status: 403,
          headers: {
            'content-type': 'text/plain; charset=utf-8'
          }
        })
      );
    }

    return secureNoStore(NextResponse.next());
  }

  if (pathname === '/preview-blocked') {
    return secureNoStore(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/s/:path*', '/preview-blocked']
};

