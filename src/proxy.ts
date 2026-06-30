import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Habilita o contexto de autenticação do Clerk em todas as rotas. Não força
 * login em lugar nenhum — as páginas seguem públicas e o app continua
 * funcionando offline. Só a rota `/api/fastmedic` exige conta + assinatura
 * ativa, e essa verificação é feita dentro da própria rota.
 *
 * No Next.js 16 a convenção `middleware.ts` virou `proxy.ts`.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos e internos do Next.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Sempre roda nas rotas de API.
    '/(api|trpc)(.*)',
    // Proxy automático do Clerk (handshake/frontend API).
    '/__clerk/:path*',
  ],
};
