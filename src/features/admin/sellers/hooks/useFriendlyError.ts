import type { SellerApiError } from '../service/sellersApi';

export function friendlyError(err: unknown): string {
  if (!err) return 'Erro desconhecido.';
  const e = err as SellerApiError;
  switch (e.code) {
    case 'unauthenticated':
      return 'Sua sessão expirou. Entre de novo.';
    case 'not_admin':
      return 'Você não tem permissão para essa ação.';
    case 'email_in_use':
      return 'Este e-mail já está em uso.';
    case 'cannot_deactivate_self':
      return 'Você não pode desativar a si mesmo.';
    case 'network_error':
      return 'Sem conexão. Tente novamente quando a internet voltar.';
    case 'validation_error':
      switch (e.field) {
        case 'name':
          return 'Nome é obrigatório.';
        case 'email':
          return 'E-mail inválido.';
        case 'password':
          return 'Senha precisa ter pelo menos 8 caracteres.';
        case 'mode':
          return 'Escolha como o vendedor receberá acesso.';
      }
      return 'Verifique os campos do formulário.';
    case 'unknown':
      return e.message ? `Erro: ${e.message}` : 'Erro desconhecido.';
    default:
      return 'Erro desconhecido.';
  }
}
