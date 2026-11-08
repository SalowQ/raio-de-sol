export interface PerfilUsuario {
  id: string;
  nome: string;
  papel: 'funcionario';
  ativo: boolean;
}

export function ehPerfilUsuario(valor: unknown): valor is PerfilUsuario {
  if (!valor || typeof valor !== 'object') {
    return false;
  }

  const registro = valor as Record<string, unknown>;
  return (
    typeof registro['id'] === 'string' &&
    typeof registro['nome'] === 'string' &&
    registro['papel'] === 'funcionario' &&
    typeof registro['ativo'] === 'boolean'
  );
}
