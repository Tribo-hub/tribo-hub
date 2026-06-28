import { SetMetadata } from '@nestjs/common';

// Marca rotas que continuam acessíveis mesmo com a conta bloqueada por inadimplência
// (ex.: ver a própria fatura, pagar, perfil). O SubscriptionStatusGuard respeita esta marca.
export const PERMITIR_INADIMPLENTE = 'permitir_inadimplente';
export const PermitirInadimplente = () => SetMetadata(PERMITIR_INADIMPLENTE, true);
